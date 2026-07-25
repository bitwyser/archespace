import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArchiveRestore,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Copy,
  Download,
  GitFork,
  Keyboard,
  Layers,
  ListChecks,
  LockKeyhole,
  Mail,
  Palette,
  RefreshCw,
  Save,
  Search,
  Server,
  ShieldCheck,
  Smartphone,
  WifiOff,
} from 'lucide-react'
import { ITEM_TYPE_OPTIONS } from '../lib/itemTypes'
import { APP_VERSION, BUILD_HASH, COMMIT_URL, REPO_URL } from '../lib/buildInfo'

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

/** Shared nav button styles so every control in the header matches. */
const navButtonClass =
  'home-link-lift inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm text-white/80 hover:bg-white/15 hover:text-white transition-colors'
const navPrimaryClass =
  'home-link-lift inline-flex items-center gap-2 rounded-lg bg-emerald-300 px-4 py-2 text-sm font-semibold text-[#10201c] hover:bg-emerald-200 transition-colors'

const heroWords = ['Arche', 'Private', 'Own']

const features = [
  { icon: Layers, label: 'A space for every project' },
  { icon: Boxes, label: 'Multiple formats' },
  { icon: Search, label: 'Search across everything' },
  { icon: WifiOff, label: 'Works offline' },
  { icon: RefreshCw, label: 'Syncs across devices' },
  { icon: Save, label: 'Saves as you type' },
  { icon: ArchiveRestore, label: 'Archive and recycle bin' },
  { icon: ListChecks, label: 'Bulk actions' },
  { icon: Copy, label: 'Duplicate and move' },
  { icon: Download, label: 'Backup and restore' },
  { icon: Keyboard, label: 'Command palette and shortcuts' },
  { icon: Palette, label: 'Themes' },
]

const steps = [
  {
    step: '01',
    title: 'Sign in',
    body: 'Email and password get you into the account. That is all this step does.',
  },
  {
    step: '02',
    title: 'Unlock your vault',
    body: 'A separate PIN or passphrase becomes your key, on your device. It is never sent anywhere.',
  },
  {
    step: '03',
    title: 'Start writing',
    body: 'Everything is locked before it leaves the tab. Unlock on any device and it reads back plainly.',
  },
]

const serverFacts = [
  'Two secrets: one proves who you are, the other unlocks your content.',
  'Your key is built on your device, never on the server.',
  'The database holds unreadable content plus plain metadata like ids, timestamps, and order.',
  'No reset link and no override. Lose the PIN and the recovery code and it stays sealed.',
]

export default function HomePage() {
  const [heroWordIndex, setHeroWordIndex] = useState(0)
  const heroWord = heroWords[heroWordIndex]
  const year = new Date().getFullYear()

  useEffect(() => {
    const interval = window.setInterval(() => {
      setHeroWordIndex(index => (index + 1) % heroWords.length)
    }, 3000)

    return () => window.clearInterval(interval)
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
      className="home-page min-h-screen bg-[#0f1117] text-white overflow-hidden"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative h-[100svh] overflow-hidden px-4 sm:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(50,211,170,0.18),transparent_28%),radial-gradient(circle_at_80%_16%,rgba(124,106,247,0.18),transparent_30%),linear-gradient(135deg,#0f1117_0%,#171923_46%,#11221f_100%)]" />
        <div className="absolute inset-0 opacity-[0.18] bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:44px_44px]" />

        <div className="absolute inset-0 pointer-events-none">
          <div className="home-float absolute top-[16%] left-[5%] hidden md:block w-56 rounded-xl border border-white/10 bg-white/[0.07] backdrop-blur-md p-4 shadow-2xl">
            <div className="flex items-center gap-2 text-xs text-emerald-200">
              <CheckCircle2 size={14} />
              Draft ideas
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-2.5 w-5/6 rounded-full bg-white/30" />
              <div className="h-2.5 w-2/3 rounded-full bg-white/15" />
              <div className="h-2.5 w-3/4 rounded-full bg-emerald-300/30" />
            </div>
          </div>

          <div className="home-float-delayed absolute top-[24%] right-[6%] hidden lg:block w-64 rounded-xl border border-white/10 bg-[#171923]/80 backdrop-blur-md p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/60">Launch plan</span>
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-cyan-300/15 border border-cyan-200/20 p-3">
                <div className="h-2 w-12 rounded-full bg-cyan-200/50" />
                <div className="mt-2 h-8 rounded bg-white/10" />
              </div>
              <div className="rounded-lg bg-violet-300/15 border border-violet-200/20 p-3">
                <div className="h-2 w-10 rounded-full bg-violet-200/50" />
                <div className="mt-2 h-8 rounded bg-white/10" />
              </div>
            </div>
          </div>
        </div>

        <header className="absolute left-0 right-0 top-0 z-50 flex items-center justify-end px-4 py-4 sm:px-8 sm:py-5">
          <nav className="flex items-center gap-2">
            <a href="#features" className={`${navButtonClass} hidden md:inline-flex`}>
              Features
            </a>
            <a href="#how-it-works" className={`${navButtonClass} hidden md:inline-flex`}>
              How it works
            </a>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className={`${navButtonClass} hidden sm:inline-flex`}
            >
              <GithubMark size={16} />
              GitHub
            </a>
            <Link to="/login" className={navPrimaryClass}>
              Sign in
              <ArrowRight size={16} />
            </Link>
          </nav>
        </header>

        <div className="relative z-10 mx-auto flex h-full max-w-4xl flex-col items-center justify-center px-1 pt-20 pb-10 text-center sm:pt-24 sm:pb-12">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-emerald-200/10 px-3 py-1.5 text-xs font-medium text-emerald-100">
            <ShieldCheck size={14} />
            Encrypted private space
          </p>
          <h1 className="max-w-4xl text-4xl font-semibold leading-[1.02] tracking-normal sm:text-6xl lg:text-7xl">
            Your{' '}
            <span
              key={heroWord}
              className="home-word inline-block text-cyan-200 drop-shadow-[0_0_22px_rgba(103,232,249,0.3)]"
            >
              {heroWord}
            </span>{' '}
            Space
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/72 sm:text-lg">
            An open-source space to capture, organise, and come back to everything you are
            working on. Yours alone, on every device.
          </p>
          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
            <Link
              to="/login"
              className="home-link-lift inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-300 px-5 py-3 text-sm font-semibold text-[#10201c] shadow-lg shadow-emerald-950/40 hover:bg-emerald-200 transition-colors"
            >
              Open the app
              <ArrowRight size={16} />
            </Link>
            <a
              href="#how-it-works"
              className="home-link-lift inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/15 transition-colors"
            >
              See how it works
            </a>
          </div>
        </div>
      </section>

      {/* ── Formats ──────────────────────────────────────── */}
      <section className="border-t border-white/5 bg-[#101820] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-sm font-semibold text-emerald-200">One space, multiple formats</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-normal sm:text-3xl">
              Every shape a thought takes
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/60">
              Pick whichever fits the moment, and switch as the work changes. More arrive
              over time.
            </p>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                  <p className="mt-0.5 text-xs leading-5 text-white/55">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────── */}
      <section id="features" className="scroll-mt-20 bg-[#0f1117] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-emerald-200">Why Arche Space</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
              Made for the way you actually work
            </h2>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3.5 transition-colors hover:border-emerald-200/25"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200/20 bg-emerald-200/10">
                  <Icon size={17} className="text-emerald-200" />
                </span>
                <span className="text-sm font-medium text-white/85">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works (incl. what the server stores) ──── */}
      <section id="how-it-works" className="scroll-mt-20 border-y border-white/5 bg-[#101820] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-emerald-200">How it works</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
              Three steps, then it gets out of the way
            </h2>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {steps.map(({ step, title, body }) => (
              <article key={step} className="rounded-xl border border-white/10 bg-white/[0.05] p-6">
                <span className="font-mono text-xs font-semibold text-emerald-200/70">{step}</span>
                <h3 className="mt-3 text-lg font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/62">{body}</p>
              </article>
            ))}
          </div>

          <div className="mt-14 border-t border-white/10 pt-12">
            <div className="max-w-xl">
              <h3 className="text-2xl font-semibold tracking-normal">What the server stores</h3>
              <p className="mt-3 text-sm leading-6 text-white/62">
                Your key never reaches us, so there is nothing on our side to unlock.
              </p>
            </div>

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
                    <div className="flex items-center gap-2 pt-1 text-xs text-white/50">
                      <CheckCircle2 size={13} className="text-emerald-300" />
                      Draft announcement
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
                  <p className="flex items-center gap-2 text-xs font-semibold text-white/50">
                    <LockKeyhole size={14} />
                    What we store
                  </p>
                  <div className="mt-4 space-y-2 break-all font-mono text-[11px] leading-5 text-white/35">
                    <p>arc1:9tGf2xQ.8kZp1vLm4Rd0</p>
                    <p>arc1:Wq7hB3n.Yc6sT2eJ9uXa</p>
                    <p>arc1:Kd4mV8r.Pz5nQ1wE7bHt</p>
                  </div>
                  <p className="mt-4 text-[11px] leading-5 text-white/40">
                    The same three items.
                  </p>
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

      {/* ── Built in the open ────────────────────────────── */}
      <section className="bg-[#0f1117] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-emerald-200">Built in the open</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
              Use ours, or run your own
            </h2>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <article className="rounded-xl border border-white/10 bg-white/[0.05] p-6">
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

            <article className="rounded-xl border border-white/10 bg-white/[0.05] p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-200/20 bg-emerald-200/10">
                <GitFork size={19} className="text-emerald-200" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-white">Auditable by anyone</h3>
              <p className="mt-2 text-sm leading-6 text-white/62">
                Every line is public, and Settings shows the exact commit your browser is
                running. You can check that what ships matches what is published.
              </p>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-200 hover:underline"
              >
                Browse the source
                <ArrowRight size={14} />
              </a>
            </article>

            <article className="rounded-xl border border-white/10 bg-white/[0.05] p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-200/20 bg-emerald-200/10">
                <Mail size={19} className="text-emerald-200" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-white">Talk to a human</h3>
              <p className="mt-2 text-sm leading-6 text-white/62">
                Trouble with setup, sign-in, or recovery? Email{' '}
                <a className="font-semibold text-emerald-200 hover:underline" href="mailto:help@archespace.cc">
                  help@archespace.cc
                </a>
                . Feature ideas and bug reports go to{' '}
                <a className="font-semibold text-emerald-200 hover:underline" href="mailto:dev@archespace.cc">
                  dev@archespace.cc
                </a>
                .
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-white/5 bg-[#12141b] px-4 py-20 text-center sm:px-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(50,211,170,0.12),transparent_55%)]" />
        <div className="relative mx-auto max-w-3xl">
          <h2 className="text-3xl font-semibold tracking-normal sm:text-4xl">
            A quiet place for everything you are shaping
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/60">
            The half-formed idea, the running list, the plan you keep revising, and the
            thing you must not forget, all kept in one space.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/login"
              className="home-link-lift inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-300 px-5 py-3 text-sm font-semibold text-[#10201c] hover:bg-emerald-200 transition-colors"
            >
              Open the app
              <ArrowRight size={16} />
            </Link>
            <a
              href="#"
              className="home-link-lift inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/15 transition-colors"
            >
              <Smartphone size={16} />
              Get it on Android
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="border-t border-white/10 bg-[#0d0f14] px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <p className="text-sm font-semibold text-white">Arche Space</p>
              <p className="mt-3 max-w-xs text-sm leading-6 text-white/50">
                An open-source, private, encrypted space for everything you are working on.
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Product</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li><a href="#features" className="text-white/60 hover:text-white transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="text-white/60 hover:text-white transition-colors">How it works</a></li>
                <li><Link to="/login" className="text-white/60 hover:text-white transition-colors">Sign in</Link></li>
                <li><a href="#" className="text-white/60 hover:text-white transition-colors">Android app</a></li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Project</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-white/60 hover:text-white transition-colors">
                    Source code
                  </a>
                </li>
                <li>
                  <a href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer" className="text-white/60 hover:text-white transition-colors">
                    Report an issue
                  </a>
                </li>
                <li>
                  <a href={`${REPO_URL}#setup`} target="_blank" rel="noreferrer" className="text-white/60 hover:text-white transition-colors">
                    Self-hosting
                  </a>
                </li>
                <li>
                  <a href={`${REPO_URL}/blob/main/LICENSE`} target="_blank" rel="noreferrer" className="text-white/60 hover:text-white transition-colors">
                    License
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Contact</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <a href="mailto:help@archespace.cc" className="text-white/60 hover:text-white transition-colors">
                    help@archespace.cc
                  </a>
                </li>
                <li>
                  <a href="mailto:dev@archespace.cc" className="text-white/60 hover:text-white transition-colors">
                    dev@archespace.cc
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center">
            <p className="text-xs text-white/40">
              © {year} Arche Space. Created and maintained by the Arche Space Project.
            </p>
            <p className="text-xs text-white/40">
              v{APP_VERSION} · build{' '}
              <a
                href={COMMIT_URL}
                target="_blank"
                rel="noreferrer"
                className="font-mono underline hover:text-white/70 transition-colors"
              >
                {BUILD_HASH}
              </a>
            </p>
          </div>
        </div>
      </footer>
    </main>
  )
}
