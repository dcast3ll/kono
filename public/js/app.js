import { api, setUnauthorizedHandler } from "./api.js"
import {
  todayLocal,
  shiftIsoDate,
  formatDisplayDate,
  weekStart,
  formatTime as formatTimeInZone,
  formatMinutes as formatDuration,
  isUnlockTokenFresh,
} from "./date.js"

const UNLOCK_KEY = "kono_unlock_token"

const TYPE_META = {
  IDEA: { icon: "💡", label: "Idea" },
  PRIVATE: { icon: "🔒", label: "Private" },
  CHECKLIST: { icon: "☑️", label: "List" },
  WORK: { icon: "💼", label: "Work" },
}

function newKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return Math.random().toString(36).slice(2)
}

function emptyEditor() {
  return {
    type: "IDEA",
    title: "",
    text: "",
    items: [{ key: newKey(), text: "" }],
    task: "",
    hours: 0,
    minutes: 0,
    error: "",
    loading: false,
  }
}

function emptySearch() {
  return {
    q: "",
    all: false,
    type: "",
    active: false,
    results: [],
    loading: false,
    limit: 20,
    offset: 0,
    total: 0,
  }
}

function konoApp() {
  return {
    view: "loading",
    user: null,
    profile: null,
    currentDate: todayLocal(),
    notes: [],
    notesLoading: false,
    toast: "",
    toastTimer: null,
    unlocked: false,
    unlockToken: null,
    pinModal: { open: false, mode: "verify", pin: "", confirm: "", error: "", loading: false },
    auth: { mode: "login", email: "", password: "", loading: false, error: "", message: "" },
    editor: emptyEditor(),
    search: emptySearch(),
    timesheet: { dayTotal: 0, weekTotal: 0, days: [] },

    async init() {
      setUnauthorizedHandler(() => this.handleUnauthorized())

      const stored = sessionStorage.getItem(UNLOCK_KEY)
      if (stored && isUnlockTokenFresh(stored)) {
        this.unlockToken = stored
        this.unlocked = true
      }

      await this.bootstrap()
    },

    async bootstrap() {
      this.view = "loading"
      try {
        const data = await api("/api/auth/me")
        this.user = data.user
        this.profile = data.profile
        this.view = "app"
        await Promise.all([this.loadNotes(), this.loadTimesheet()])
      } catch (error) {
        this.view = "auth"
        if (error.status !== 401) this.auth.error = error.message
      }
    },

    handleUnauthorized() {
      this.user = null
      this.profile = null
      this.view = "auth"
      this.lockNow(false)
    },

    notify(message) {
      this.toast = message
      clearTimeout(this.toastTimer)
      this.toastTimer = setTimeout(() => {
        this.toast = ""
      }, 4000)
    },

    async toggleAuthMode() {
      this.auth.mode = this.auth.mode === "login" ? "register" : "login"
      this.auth.error = ""
      this.auth.message = ""
    },

    async submitAuth() {
      this.auth.error = ""
      this.auth.message = ""
      this.auth.loading = true
      try {
        const body = { email: this.auth.email.trim(), password: this.auth.password }

        if (this.auth.mode === "login") {
          await api("/api/auth/login", { method: "POST", body })
          this.auth.password = ""
          await this.bootstrap()
          return
        }

        const data = await api("/api/auth/register", { method: "POST", body })
        if (data.status === "confirmation_required") {
          this.auth.message = "Check your email to confirm your account, then sign in."
          this.auth.mode = "login"
        } else {
          this.auth.password = ""
          await this.bootstrap()
        }
      } catch (error) {
        this.auth.error = error.message
      } finally {
        this.auth.loading = false
      }
    },

    async logout() {
      try {
        await api("/api/auth/logout", { method: "POST" })
      } catch {
        // ignore network errors on logout
      }
      sessionStorage.removeItem(UNLOCK_KEY)
      this.unlockToken = null
      this.unlocked = false
      this.notes = []
      this.search = emptySearch()
      this.editor = emptyEditor()
      this.view = "auth"
      this.auth.password = ""
      this.auth.error = ""
      this.auth.message = ""
    },

    onDateChange() {
      if (this.search.active) this.clearSearch()
      this.loadNotes()
      this.loadTimesheet()
    },

    shiftDate(days) {
      this.currentDate = shiftIsoDate(this.currentDate, days)
      this.onDateChange()
    },

    goToday() {
      this.currentDate = todayLocal()
      this.onDateChange()
    },

    displayDate() {
      return formatDisplayDate(this.currentDate)
    },

    pickDate(input) {
      if (!input) return
      try {
        input.showPicker()
      } catch {
        input.click()
      }
    },

    async loadNotes() {
      this.notesLoading = true
      if (this.unlockToken && !isUnlockTokenFresh(this.unlockToken)) this.lockNow(false)
      try {
        const data = await api(`/api/notes?date=${this.currentDate}`, {
          unlockToken: this.unlockToken,
        })
        this.notes = data.notes
      } catch (error) {
        if (error.status !== 401) this.notify(error.message)
      } finally {
        this.notesLoading = false
      }
    },

    resetEditor() {
      this.editor = emptyEditor()
    },

    addItem() {
      this.editor.items.push({ key: newKey(), text: "" })
    },

    removeItem(index) {
      this.editor.items.splice(index, 1)
      if (this.editor.items.length === 0) this.addItem()
    },

    async submitNote() {
      this.editor.error = ""
      const type = this.editor.type

      if (type === "PRIVATE" && !this.profile?.pinConfigured) {
        this.editor.error = "Set a PIN before creating private notes."
        return
      }

      const payload = {
        type,
        note_date: this.currentDate,
        title: this.editor.title.trim() || null,
      }

      if (type === "IDEA" || type === "PRIVATE") {
        const text = this.editor.text.trim()
        if (!text) {
          this.editor.error = "Write something first."
          return
        }
        payload.content = { text }
      } else if (type === "CHECKLIST") {
        const items = this.editor.items
          .map((item) => ({ text: item.text.trim() }))
          .filter((item) => item.text)
        if (items.length === 0) {
          this.editor.error = "Add at least one item."
          return
        }
        payload.content = items
      } else if (type === "WORK") {
        const task = this.editor.task.trim()
        const duration =
          (Number(this.editor.hours) || 0) * 60 + (Number(this.editor.minutes) || 0)
        if (!task) {
          this.editor.error = "Describe the task."
          return
        }
        if (duration < 1) {
          this.editor.error = "Duration must be greater than zero."
          return
        }
        payload.content = { task, duration_mins: duration }
      }

      this.editor.loading = true
      try {
        const data = await api("/api/notes", {
          method: "POST",
          body: payload,
          unlockToken: this.unlockToken,
        })
        this.notes.push(data.note)
        this.resetEditor()
        if (type === "WORK") await this.loadTimesheet()
      } catch (error) {
        this.editor.error = error.message
      } finally {
        this.editor.loading = false
      }
    },

    async deleteNote(note) {
      if (!confirm("Delete this note?")) return
      try {
        await api(`/api/notes/${note.id}`, {
          method: "DELETE",
          unlockToken: this.unlockToken,
        })
        this.notes = this.notes.filter((item) => item.id !== note.id)
        if (note.type === "WORK") await this.loadTimesheet()
      } catch (error) {
        this.notify(error.message)
      }
    },

    async toggleItem(note, item, done) {
      const previous = item.done
      item.done = done
      try {
        const data = await api(`/api/notes/${note.id}/items/${item.id}`, {
          method: "PATCH",
          body: { done },
          unlockToken: this.unlockToken,
        })
        note.content = data.note.content
      } catch (error) {
        item.done = previous
        this.notify(error.message)
      }
    },

    openPin() {
      if (this.unlocked) {
        this.lockNow()
        return
      }
      this.pinModal = {
        open: true,
        mode: this.profile?.pinConfigured ? "verify" : "setup",
        pin: "",
        confirm: "",
        error: "",
        loading: false,
      }
    },

    closePin() {
      this.pinModal.open = false
    },

    async submitPin() {
      this.pinModal.error = ""
      const pin = this.pinModal.pin.trim()

      if (!/^\d{4,12}$/.test(pin)) {
        this.pinModal.error = "PIN must be 4 to 12 digits."
        return
      }

      this.pinModal.loading = true
      try {
        if (this.pinModal.mode === "setup") {
          if (pin !== this.pinModal.confirm.trim()) {
            this.pinModal.error = "PINs do not match."
            return
          }
          await api("/api/pin/setup", { method: "POST", body: { pin } })
          if (this.profile) this.profile.pinConfigured = true
          this.pinModal.mode = "verify"
        }

        const data = await api("/api/pin/verify", { method: "POST", body: { pin } })
        this.unlockToken = data.unlockToken
        this.unlocked = true
        sessionStorage.setItem(UNLOCK_KEY, data.unlockToken)
        this.pinModal.open = false
        await this.loadNotes()
      } catch (error) {
        this.pinModal.error = error.message
      } finally {
        this.pinModal.loading = false
      }
    },

    lockNow(reload = true) {
      sessionStorage.removeItem(UNLOCK_KEY)
      this.unlockToken = null
      this.unlocked = false
      if (reload) this.loadNotes()
    },

    clearSearch() {
      this.search = emptySearch()
    },

    async runSearch() {
      const query = this.search.q.trim()
      if (!query) {
        this.clearSearch()
        return
      }
      this.search.active = true
      this.search.offset = 0
      await this.fetchSearch(true)
    },

    async loadMoreSearch() {
      if (this.search.results.length >= this.search.total) return
      this.search.offset += this.search.limit
      await this.fetchSearch(false)
    },

    async fetchSearch(reset) {
      this.search.loading = true
      try {
        const params = new URLSearchParams({
          q: this.search.q.trim(),
          limit: String(this.search.limit),
          offset: String(this.search.offset),
        })
        if (this.search.all) params.set("all", "true")
        else params.set("date", this.currentDate)
        if (this.search.type) params.set("type", this.search.type)

        const data = await api(`/api/notes/search?${params.toString()}`, {
          unlockToken: this.unlockToken,
        })
        this.search.results = reset ? data.notes : [...this.search.results, ...data.notes]
        this.search.total = data.total ?? this.search.results.length
      } catch (error) {
        this.notify(error.message)
      } finally {
        this.search.loading = false
      }
    },

    async loadTimesheet() {
      try {
        const from = weekStart(this.currentDate)
        const data = await api(
          `/api/notes/timesheet?from=${from}&to=${this.currentDate}`,
          { unlockToken: this.unlockToken },
        )
        this.timesheet.days = data.days
        this.timesheet.weekTotal = data.total_mins
        this.timesheet.dayTotal =
          data.days.find((day) => day.date === this.currentDate)?.total_mins ?? 0
      } catch {
        // timesheet is non-critical
      }
    },

    typeIcon(type) {
      return TYPE_META[type]?.icon ?? "•"
    },

    typeLabel(type) {
      return TYPE_META[type]?.label ?? type
    },

    formatTime(value) {
      return formatTimeInZone(value, this.profile?.timezone ?? "America/Bogota")
    },

    formatMinutes(value) {
      return formatDuration(value)
    },
  }
}

if (typeof window !== "undefined") window.konoApp = konoApp

export { konoApp }
