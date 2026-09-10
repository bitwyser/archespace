import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArchiveRestore,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Download,
  FileDown,
  Fingerprint,
  FolderTree,
  GitFork,
  Keyboard,
  Layers,
  LockKeyhole,
  Mail,
  Menu,
  Palette,
  Pin,
  RefreshCw,
  Save,
  Search,
  Server,
  ShieldCheck,
  Smartphone,
  Tag,
  Users,
  WifiOff,
  X,
} from 'lucide-react'
import { ITEM_TYPE_OPTIONS } from '../lib/itemTypes'
import { BrandGlyph } from '../components/BrandGlyph'
import { APP_VERSION, COMMIT_URL, MOBILE_REPO_URL, REPO_URL } from '../lib/buildInfo'

function GithubMark({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.1 3.29 9.4 7.86 10.93.58.1.79-.25.79-.56v-2.15c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.27-5.23-5.67 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.17 1.18.92-.26 1.9-.38 2.88-.39.98.01 1.96.13 2.88.39 2.2-1.49 3.16-1.18 3.16-1.18.64 1.58.24 2.75.12 3.04.74.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.38-5.25 5.66.41.36.78 1.06.78 2.14v3.18c0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  )
}

// One primary and one quiet style, reused everywhere so identical actions look
// identical (Law of Similarity) and the primary path always stands out
// (Von Restorff). Generous padding keeps every target easy to hit (Fitts).
const btnPrimary =
  'home-link-lift inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-300 px-5 py-2.5 text-sm font-semibold text-[#0c1a16] shadow-lg shadow-emerald-950/40 hover:bg-emerald-200 transition-colors'
const btnGhost =
  'home-link-lift inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors'
const navLink =
  'rounded-lg px-3 py-2 text-sm text-white/70 hover:text-white transition-colors'

const heroWords = ['Private', 'Organised', 'Yours']

// Section links shown in the header (desktop) and the mobile menu.
const navSections = [
  { id: 'top', href: '#top', label: 'Home' },
  { id: 'features', href: '#features', label: 'Features' },
  { id: 'how-it-works', href: '#how-it-works', label: 'How it works' },
  { id: 'open-source', href: '#open-source', label: 'Open source' },
  { id: 'mobile', href: '#mobile', label: 'Mobile' },
]

// Twenty capabilities split evenly into four labelled chunks (five each) so the
// section reads as a few ideas, not a wall of items (Miller's Law + Proximity).
const featureGroups = [
  {
    title: 'Capture and organize',
    icon: Layers,
    items: [
      { icon: Layers, label: 'A space for every project' },
      { icon: FolderTree, label: 'Nested spaces (sub-spaces)' },
      { icon: Boxes, label: 'Many item formats' },
      { icon: Tag, label: 'Tags and quick filtering' },
      { icon: Search, label: 'Search across everything' },
    ],
  },
  {
    title: 'Security and privacy',
    icon: ShieldCheck,
    items: [
      { icon: LockKeyhole, label: 'Lockable encrypted vault' },
      { icon: Server, label: 'Zero-knowledge, self-hostable' },
      { icon: ShieldCheck, label: 'Built-in 2FA authenticator' },
      { icon: Fingerprint, label: 'Passkey and biometric unlock' },
      { icon: Users, label: 'Single or multi-user mode' },
    ],
  },
  {
    title: 'Sync and access',
    icon: RefreshCw,
    items: [
      { icon: RefreshCw, label: 'Syncs across devices' },
      { icon: WifiOff, label: 'Works offline' },
      { icon: Smartphone, label: 'Native Android app, iOS soon' },
      { icon: Save, label: 'Saves as you type' },
      { icon: Download, label: 'Backup and restore' },
    ],
  },
  {
    title: 'Make it yours',
    icon: Palette,
    items: [
      { icon: Palette, label: 'Dark and light themes with accents' },
      { icon: Keyboard, label: 'Command palette and shortcuts' },
      { icon: Pin, label: 'Pin what matters' },
      { icon: FileDown, label: 'Export to PDF' },
      { icon: ArchiveRestore, label: 'Archive and recycle bin' },
    ],
  },
]

const steps = [
  {
    step: '01',
    title: 'Create your account',
    body: 'Sign up with an email and password. This only gets you into the app - it does not unlock any of your content yet.',
  },
  {
    step: '02',
    title: 'Set your vault key',
    body: 'Choose a PIN or passphrase. It becomes your encryption key on your device and is never sent to the server - not even we can see it.',
  },
  {
    step: '03',
    title: 'Start capturing',
    body: 'Add notes, lists, code, secrets, and more. Everything is encrypted on your device before it syncs, and reads back plainly on any device you unlock.',
  },
]

const serverFacts = [
  'Two separate secrets: your login proves who you are, your vault key unlocks your content.',
  'Your vault key is created on your device and never leaves it.',
  'We store only unreadable ciphertext plus plain metadata - ids, timestamps, and order.',
  'There is no reset link and no backdoor. Lose both your PIN and recovery code, and the data can never be unlocked again.',
]

/** A labelled section heading with an eyebrow, kept consistent across sections. */
function SectionHeading({ eyebrow, title, children, center = false }) {
  return (
    <div className={`reveal ${center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}`}>
      <p className="text-sm font-semibold text-emerald-200">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">{title}</h2>
      {children ? (
        <p className={`mt-4 text-sm leading-6 text-white/62 ${center ? 'mx-auto max-w-xl' : 'max-w-xl'}`}>
          {children}
        </p>
      ) : null}
    </div>
  )
}

export default function HomePage() {
  const [heroWordIndex, setHeroWordIndex] = useState(0)
  const [heroPrevIndex, setHeroPrevIndex] = useState(null)
  const [heroSlotWidth, setHeroSlotWidth] = useState(null)
  const [activeSection, setActiveSection] = useState(null)
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const heroSizerRef = useRef(null)
  const isActive = id => (id === 'top' ? !activeSection : activeSection === id)
  const year = new Date().getFullYear()

  useEffect(() => {
    // Respect reduced-motion: keep a single static word instead of cycling.
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (reduce?.matches) return

    const interval = window.setInterval(() => {
      setHeroWordIndex(index => {
        setHeroPrevIndex(index)
        return (index + 1) % heroWords.length
      })
    }, 3000)

    return () => window.clearInterval(interval)
  }, [])

  // Drop the outgoing word once its exit animation has finished.
  useEffect(() => {
    if (heroPrevIndex === null) return
    const timer = window.setTimeout(() => setHeroPrevIndex(null), 700)
    return () => window.clearTimeout(timer)
  }, [heroPrevIndex, heroWordIndex])

  // Measure the active word so the slot animates its width, keeping the
  // surrounding "Your"/"Space" from snapping when the word changes.
  useLayoutEffect(() => {
    const measure = () => {
      if (heroSizerRef.current) setHeroSlotWidth(heroSizerRef.current.offsetWidth)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [heroWordIndex])

  // Scroll-reveal animations for sections/cards, plus nav scroll-spy for the
  // active-section underline. Uses scroll position (getBoundingClientRect) so
  // it works everywhere; under reduced motion everything is shown up front.
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

    // Smooth-scroll anchor jumps while the landing page is mounted (restored on
    // unmount so in-app routing is unaffected); skipped under reduced motion.
    const root = document.documentElement
    const prevScrollBehavior = root.style.scrollBehavior
    if (!reduce) root.style.scrollBehavior = 'smooth'

    let pending = Array.from(document.querySelectorAll('.reveal, .reveal-stagger'))
    // Formats has no nav item of its own - it counts as part of Features, so
    // the Features underline stays lit while scrolling through it.
    const spyAlias = { formats: 'features' }
    const sections = ['features', 'formats', 'how-it-works', 'open-source', 'mobile']
      .map(id => document.getElementById(id))
      .filter(Boolean)
    const hero = document.getElementById('top')

    if (reduce) {
      pending.forEach(el => el.classList.add('is-visible'))
      pending = []
    }

    let ticking = false
    const update = () => {
      ticking = false
      const vh = window.innerHeight || document.documentElement.clientHeight

      // Reveal any element once its top rises past 88% of the viewport.
      for (let i = pending.length - 1; i >= 0; i--) {
        const rect = pending[i].getBoundingClientRect()
        if (rect.top < vh * 0.88 && rect.bottom > 0) {
          pending[i].classList.add('is-visible')
          pending.splice(i, 1)
        }
      }

      // Active section: the one crossing ~35% down the viewport.
      const line = vh * 0.35
      let active = null
      for (const section of sections) {
        const rect = section.getBoundingClientRect()
        if (rect.top <= line && rect.bottom >= line) {
          active = spyAlias[section.id] || section.id
          break
        }
      }
      setActiveSection(prev => (prev === active ? prev : active))

      // Header stays transparent over the hero, then turns to blurred glass
      // once the hero has scrolled up behind it.
      const glass = hero ? hero.getBoundingClientRect().bottom <= 72 : false
      setScrolled(prev => (prev === glass ? prev : glass))
    }

    const onScroll = () => {
      if (!ticking) {
        ticking = true
        window.requestAnimationFrame(update)
      }
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      root.style.scrollBehavior = prevScrollBehavior
    }
  }, [])

  const handlePointerMove = (event) => {
    event.currentTarget.style.setProperty('--home-cursor-x', `${event.clientX}px`)
    event.currentTarget.style.setProperty('--home-cursor-y', `${event.clientY}px`)
  }

  const handlePointerLeave = (event) => {
    event.currentTarget.style.setProperty('--home-cursor-x', '50vw')
    event.currentTarget.style.setProperty('--home-cursor-y', '42vh')
  }

  return (
    <main
      className="home-page min-h-screen bg-[#0f1117] text-white"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <a
        href="#top"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-emerald-300 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[#0c1a16]"
      >
        Skip to content
      </a>

      {/* ── Sticky header: familiar layout, one dominant action ──────── */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
          scrolled
            ? 'border-b border-white/5 bg-[#0f1117]/70 backdrop-blur-md'
            : 'border-b border-transparent bg-transparent'
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <a href="#top" className="flex items-center" aria-label="ArcheSpace home">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-400 text-[#0c1a16] shadow-lg shadow-emerald-950/30">
              <BrandGlyph className="h-[80%] w-[80%]" />
            </span>
          </a>
          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 lg:flex">
            {navSections.map(section => (
              <a
                key={section.id}
                href={section.href}
                className={`${navLink} home-nav-link ${isActive(section.id) ? 'is-active' : ''}`}
              >
                {section.label}
              </a>
            ))}
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className={`${navLink} home-nav-link`}
            >
              GitHub
            </a>
            <Link
              to="/signup"
              className="home-link-lift inline-flex items-center gap-2 rounded-lg bg-emerald-300 px-4 py-2 text-sm font-semibold text-[#0c1a16] hover:bg-emerald-200 transition-colors"
            >
              Get started
              <ArrowRight size={16} />
            </Link>
          </nav>

          {/* Mobile: primary action + menu toggle */}
          <div className="flex items-center gap-2 lg:hidden">
            <Link
              to="/signup"
              className="home-link-lift inline-flex items-center rounded-lg bg-emerald-300 px-3.5 py-2 text-sm font-semibold text-[#0c1a16] hover:bg-emerald-200 transition-colors"
            >
              Get started
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(open => !open)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="home-mobile-menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white transition-colors hover:bg-white/10"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div
            id="home-mobile-menu"
            className="border-t border-white/10 bg-[#0f1117]/95 backdrop-blur-md lg:hidden"
          >
            <nav className="mx-auto flex max-w-6xl flex-col px-4 py-2 sm:px-6">
              {navSections.map(section => (
                <a
                  key={section.id}
                  href={section.href}
                  onClick={() => setMenuOpen(false)}
                  className={`rounded-lg px-2 py-3 text-sm transition-colors ${
                    isActive(section.id)
                      ? 'font-medium text-white'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  {section.label}
                </a>
              ))}
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-2 py-3 text-sm text-white/70 transition-colors hover:text-white"
              >
                GitHub
              </a>
            </nav>
          </div>
        )}
      </header>

      {/* ── Hero: one message, one primary path ─────────────────────── */}
      <section
        id="top"
        className="relative flex min-h-[100svh] items-center overflow-hidden px-4 sm:px-6"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(50,211,170,0.14),transparent_55%),linear-gradient(180deg,#0f1117_0%,#12151d_100%)]" />

        <div className="hero-enter relative z-10 mx-auto flex max-w-3xl flex-col items-center py-16 text-center sm:py-20">
          <div className="hero-headline">
            <h1
              aria-label="ArcheSpace - Everything in One Encrypted Space"
              className="whitespace-normal sm:whitespace-nowrap text-[clamp(1.9rem,8vw,4.5rem)] font-semibold leading-[1.03] tracking-normal"
            >
              It&apos;s{' '}
              <span
                className="home-word-slot text-cyan-200 drop-shadow-[0_0_22px_rgba(103,232,249,0.3)]"
                style={heroSlotWidth != null ? { width: heroSlotWidth } : undefined}
              >
                <span ref={heroSizerRef} aria-hidden="true" className="home-word-sizer">
                  {heroWords[heroWordIndex]}
                </span>
                {heroPrevIndex !== null && (
                  <span key={`out-${heroPrevIndex}`} aria-hidden="true" className="home-word home-word-out">
                    {heroWords[heroPrevIndex]}
                  </span>
                )}
                <span key={`in-${heroWordIndex}`} className="home-word home-word-in">
                  {heroWords[heroWordIndex]}
                </span>
              </span>
              .
            </h1>
          </div>

          <p className="mt-6 max-w-3xl text-base leading-7 text-white/72 sm:text-lg">
            Capture and organise all your information, knowledge, projects, notes, secrets, code,{' '}
            <br className="hidden sm:inline" />
            checklists, ideas, and everything else you're working on in an open-source, encrypted space.
          </p>

          <div className="mt-9 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
            <Link to="/signup" className={`${btnPrimary} w-full sm:w-auto`}>
              Get started
              <ArrowRight size={16} />
            </Link>
            <Link to="/login" className={`${btnGhost} w-full sm:w-auto`}>
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features, grouped into four chunks ──────────────────────── */}
      <section id="features" className="scroll-mt-20 border-t border-white/5 bg-[#101820] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionHeading eyebrow="Why ArcheSpace" title="Made for the way you actually work" />

          <div className="reveal-stagger mt-12 grid gap-4 sm:grid-cols-2">
            {featureGroups.map(({ title, icon: GroupIcon, items }) => (
              <article key={title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200/20 bg-emerald-200/10">
                    <GroupIcon size={17} className="text-emerald-200" />
                  </span>
                  <h3 className="text-base font-semibold text-white">{title}</h3>
                </div>
                <ul className="mt-5 grid gap-2.5 sm:grid-cols-1">
                  {items.map(({ icon: Icon, label }) => (
                    <li key={label} className="flex items-center gap-2.5 text-sm text-white/78">
                      <Icon size={15} className="shrink-0 text-emerald-200/80" />
                      {label}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Formats ─────────────────────────────────────────────────── */}
      <section id="formats" className="scroll-mt-20 bg-[#0f1117] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionHeading center eyebrow="One space, many formats" title="Every shape a thought takes">
            Pick whichever fits the moment, and switch as the work changes. More arrive over time.
          </SectionHeading>

          <div className="reveal-stagger mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ITEM_TYPE_OPTIONS.map(({ type, label, desc, icon: Icon, color, bg }) => (
              <div
                key={type}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4"
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${bg}`}>
                  <Icon size={17} className={color} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-white">{label}</h3>
                  <p className="mt-0.5 text-xs leading-5 text-white/65">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works: a short, visible progression ──────────────── */}
      <section id="how-it-works" className="scroll-mt-20 border-y border-white/5 bg-[#101820] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionHeading eyebrow="How it works" title="Set up once, then just work" />

          <ol className="reveal-stagger mt-12 grid gap-4 md:grid-cols-3">
            {steps.map(({ step, title, body }, i) => (
              <li key={step} className="relative rounded-2xl border border-white/10 bg-white/[0.05] p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-300 font-mono text-xs font-bold text-[#0c1a16]">
                    {i + 1}
                  </span>
                  <span className="font-mono text-xs font-semibold text-white/40">{step}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/62">{body}</p>
              </li>
            ))}
          </ol>

          {/* What the server stores: the trust payoff of the flow above. */}
          <div className="mt-16 border-t border-white/10 pt-12">
            <SectionHeading eyebrow="What the server stores" title="Nothing on our side can unlock it">
              Your vault key never reaches us, so there is nothing on our servers that we - or
              anyone else - could ever read.
            </SectionHeading>

            <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-200/25 bg-emerald-200/[0.06] p-5">
                  <p className="flex items-center gap-2 text-xs font-semibold text-emerald-200">
                    <CheckCircle2 size={14} />
                    What you see
                  </p>
                  <div className="mt-4 space-y-2.5">
                    <p className="text-sm font-semibold text-white">Q3 launch plan</p>
                    <p className="text-xs leading-5 text-white/60">
                      Pricing review, then the migration checklist
                    </p>
                    <div className="flex items-center gap-2 pt-1 text-xs text-white/60">
                      <CheckCircle2 size={13} className="text-emerald-300" />
                      Draft announcement
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
                  <p className="flex items-center gap-2 text-xs font-semibold text-white/60">
                    <LockKeyhole size={14} />
                    What we store
                  </p>
                  <div className="mt-4 space-y-2 break-all font-mono text-[11px] leading-5 text-white/35">
                    <p>arc1:9tGf2xQ.8kZp1vLm4Rd0</p>
                    <p>arc1:Wq7hB3n.Yc6sT2eJ9uXa</p>
                    <p>arc1:Kd4mV8r.Pz5nQ1wE7bHt</p>
                  </div>
                  <p className="mt-4 text-[11px] leading-5 text-white/65">The same three items.</p>
                </div>
              </div>

              <ul className="space-y-3">
                {serverFacts.map(fact => (
                  <li key={fact} className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4">
                    <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-200" />
                    <span className="text-sm leading-6 text-white/72">{fact}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Built in the open ───────────────────────────────────────── */}
      <section id="open-source" className="scroll-mt-20 bg-[#0f1117] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionHeading eyebrow="Built in the open" title="Use ours, or run your own" />

          <div className="reveal-stagger mt-12 grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-white/10 bg-white/[0.05] p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-200/20 bg-emerald-200/10">
                <Server size={19} className="text-emerald-200" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-white">Self-host in an afternoon</h3>
              <p className="mt-2 text-sm leading-6 text-white/62">
                Point it at your own Supabase project and deploy the static build anywhere.
                Single-user mode is the default; flip one flag to open sign-ups to a small
                trusted group.
              </p>
              <a
                href={`${REPO_URL}#setup`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-200 hover:underline"
              >
                Read the setup guide
                <ArrowRight size={14} />
              </a>
            </article>

            <article className="rounded-2xl border border-white/10 bg-white/[0.05] p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-200/20 bg-emerald-200/10">
                <GitFork size={19} className="text-emerald-200" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-white">Auditable by anyone</h3>
              <p className="mt-2 text-sm leading-6 text-white/62">
                Every line of the web and mobile apps is public. Settings shows the exact
                commit your browser is running, so you can confirm that what ships is what's 
                published.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-200 hover:underline"
                >
                  Web source
                  <ArrowRight size={14} />
                </a>
                <a
                  href={MOBILE_REPO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-200 hover:underline"
                >
                  Mobile source
                  <ArrowRight size={14} />
                </a>
              </div>
            </article>

            <article className="rounded-2xl border border-white/10 bg-white/[0.05] p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-200/20 bg-emerald-200/10">
                <Mail size={19} className="text-emerald-200" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-white">Talk to a human</h3>
              <p className="mt-2 text-sm leading-6 text-white/62">
                Trouble with setup, sign-in, or recovery? Email{' '}
                <a className="font-semibold text-emerald-200 hover:underline" href="mailto:help@archespace.app">
                  help@archespace.app
                </a>
                . Feature ideas and bug reports go to{' '}
                <a className="font-semibold text-emerald-200 hover:underline" href="mailto:bitwyser@archespace.app">
                  bitwyser@archespace.app
                </a>
                .
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* ── Mobile app ──────────────────────────────────────────────── */}
      <section id="mobile" className="scroll-mt-20 border-t border-white/5 bg-[#101820] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <SectionHeading eyebrow="Also on Android" title="Your space, in your pocket">
                A native Android app, built with Flutter and open source like the web - iOS
                coming soon. It's the same zero-knowledge vault: unlock with your PIN or
                biometrics, and your spaces sync across every device. In active development, so
                follow along or build it yourself on GitHub.
              </SectionHeading>
              <div className="mt-8">
                <a
                  href={MOBILE_REPO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className={btnGhost}
                >
                  <GithubMark size={16} />
                  View the mobile app on GitHub
                </a>
              </div>
            </div>

            {/* Phone mockup */}
            <div className="flex justify-center lg:justify-end" aria-hidden="true">
              <div className="w-full max-w-[248px] rounded-[2rem] border border-white/12 bg-[#141824] p-3 shadow-2xl">
                <div className="rounded-[1.5rem] border border-white/8 bg-[#0f1117] p-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-300 to-cyan-300 text-[#10201c]">
                      <BrandGlyph className="h-[72%] w-[72%]" />
                    </span>
                    <span className="text-sm font-semibold text-white">ArcheSpace</span>
                    <LockKeyhole size={13} className="ml-auto text-emerald-200/70" />
                  </div>
                  <div className="mt-4 space-y-2.5">
                    <div className="rounded-lg border border-white/8 bg-white/[0.04] p-3">
                      <div className="h-2 w-20 rounded-full bg-white/25" />
                      <div className="mt-2 h-2 w-28 rounded-full bg-white/10" />
                    </div>
                    <div className="rounded-lg border border-emerald-200/20 bg-emerald-200/[0.06] p-3">
                      <div className="h-2 w-16 rounded-full bg-emerald-200/40" />
                      <div className="mt-2 h-2 w-24 rounded-full bg-white/10" />
                    </div>
                    <div className="rounded-lg border border-white/8 bg-white/[0.04] p-3">
                      <div className="h-2 w-24 rounded-full bg-white/20" />
                      <div className="mt-2 h-2 w-14 rounded-full bg-white/10" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA: a strong, clear close ────────────────────────── */}
      <section className="relative overflow-hidden border-t border-white/5 bg-[#12141b] px-4 py-24 text-center sm:px-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(50,211,170,0.12),transparent_55%)]" />
        <div className="relative mx-auto max-w-3xl">
          <h2 className="text-3xl font-semibold tracking-normal sm:text-4xl">
            A quiet place for everything you are shaping
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/60">
            The half-formed idea, the running list, the plan you keep revising, and the thing
            you must not forget, all kept in one space.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/signup" className={btnPrimary}>
              Get started
              <ArrowRight size={16} />
            </Link>
            <a href={MOBILE_REPO_URL} target="_blank" rel="noreferrer" className={btnGhost}>
              <Smartphone size={16} />
              See the mobile app
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 bg-[#0d0f14] px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <img src="/archespace-logo.svg" alt="ArcheSpace" className="h-7 w-auto" />
              <p className="mt-3 max-w-xs text-sm leading-6 text-white/60">
                An open-source, encrypted space.
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/65">Product</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li><a href="#features" className="text-white/60 hover:text-white transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="text-white/60 hover:text-white transition-colors">How it works</a></li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/65">Project</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-white/60 hover:text-white transition-colors">
                    Web source
                  </a>
                </li>
                <li>
                  <a href={MOBILE_REPO_URL} target="_blank" rel="noreferrer" className="text-white/60 hover:text-white transition-colors">
                    Mobile source
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/65">Contact</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <a href="mailto:help@archespace.app" className="text-white/60 hover:text-white transition-colors">
                    help@archespace.app
                  </a>
                </li>
                <li>
                  <a href="mailto:bitwyser@archespace.app" className="text-white/60 hover:text-white transition-colors">
                    bitwyser@archespace.app
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center">
            <p className="text-xs text-white/65">
              © {year} · Created and maintained by{' '}
              <a
                href="https://github.com/bitwyser"
                target="_blank"
                rel="noreferrer"
                className="no-underline hover:text-white/70 transition-colors"
              >
                BitWyser
              </a>
              .
            </p>
            <p className="text-xs text-white/65">
              <a
                href={COMMIT_URL}
                target="_blank"
                rel="noreferrer"
                className="no-underline hover:text-white/80 transition-colors"
              >
                v{APP_VERSION}
              </a>
            </p>
          </div>
        </div>
      </footer>
    </main>
  )
}
