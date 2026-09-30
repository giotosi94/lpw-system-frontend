import {
  Boxes,
  CheckCircle2,
  Cloud,
  Code2,
  Database,
  FileArchive,
  GitBranch,
  HardDrive,
  KeyRound,
  Layers3,
  LockKeyhole,
  Network,
  Route,
  Server,
  ShieldCheck,
  Users,
  Wrench,
} from 'lucide-react'

const implementedModules = [
  'Configurazione ambiente con PLANT_ID e DATABASE_NAME',
  'Connessione MongoDB configurabile',
  'Reparti, linee e macchine',
  'Quick Kaizen e Standard Kaizen',
  'Major Kaizen e collegamenti con Quick/Standard',
  'Action Plan e collegamenti polimorfici',
]

const roadmapModules = [
  'Segnalazioni',
  'OPL e conferme di lettura',
  'Documenti, cartelle, upload e preview',
  'Pillar',
  'Dashboard e meeting',
  'Notifiche',
  'Configurazioni locali',
  'Utenti, JWT, SSO e autorizzazioni',
  'Audit completo delle query MongoDB',
]

const developmentRules = [
  'Il frontend non decide mai il plant operativo.',
  'Il backend assegna il plant tramite settings.PLANT_ID.',
  'Ogni query operativa deve essere limitata al plant corrente.',
  'I record storici senza plant_id sono considerati Induno durante la transizione.',
  'I collegamenti tra entità sono consentiti soltanto nello stesso plant.',
  'I template Corporate usano scope corporate e non diventano dati operativi condivisi.',
  'Le modifiche vengono distribuite da una sola codebase GitHub.',
]

function Section({ icon: Icon, title, subtitle, children }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-yellow-50 text-primary flex items-center justify-center flex-shrink-0">
          <Icon size={22} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </section>
  )
}

function FlowNode({ icon: Icon, title, text, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
  }
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-2 font-bold">
        <Icon size={18} />
        {title}
      </div>
      <div className="text-xs mt-2 opacity-80 leading-relaxed">{text}</div>
    </div>
  )
}

function StatusItem({ children, done = false }) {
  return (
    <li className="flex items-start gap-2 text-sm text-gray-700">
      <CheckCircle2 size={17} className={done ? 'text-green-600 mt-0.5' : 'text-gray-300 mt-0.5'} />
      <span>{children}</span>
    </li>
  )
}

export default function WikiPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      <div className="rounded-2xl bg-gradient-to-r from-primary to-primary-light text-white p-7 shadow-warm-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <div className="text-xs uppercase tracking-widest opacity-80 font-semibold">Wiki interna</div>
            <h1 className="text-3xl font-bold mt-2">Architettura LPW System</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white text-opacity-90">
              Stato dell'architettura applicativa, deploy sulla VM, isolamento multi-plant e regole tecniche
              da rispettare durante lo sviluppo.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 min-w-full lg:min-w-80">
            <div className="bg-white bg-opacity-10 rounded-xl p-3">
              <div className="text-xs opacity-75">Plant attivo</div>
              <div className="font-bold mt-1">Induno</div>
            </div>
            <div className="bg-white bg-opacity-10 rounded-xl p-3">
              <div className="text-xs opacity-75">Stato</div>
              <div className="font-bold mt-1">Pilota multi-plant</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Section icon={Layers3} title="Stack applicativo" subtitle="Componenti attualmente in esecuzione">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FlowNode icon={Code2} title="Frontend" text="React e Vite, compilazione produzione nella cartella dist." tone="blue" />
            <FlowNode icon={Server} title="Backend" text="FastAPI con Uvicorn, eseguito come servizio systemd." tone="green" />
            <FlowNode icon={Network} title="Reverse proxy" text="Nginx serve il frontend e inoltra le richieste /api al backend locale." tone="yellow" />
            <FlowNode icon={Database} title="Database" text="MongoDB Atlas con Motor/PyMongo e GridFS per file e immagini." tone="purple" />
          </div>
        </Section>

        <Section icon={GitBranch} title="Flusso di deploy" subtitle="Una sola codebase per tutti gli ambienti">
          <div className="space-y-3">
            <FlowNode icon={GitBranch} title="1. GitHub" text="Repository privati frontend e backend LPW System." tone="blue" />
            <div className="ml-5 border-l-2 border-dashed border-gray-300 h-4" />
            <FlowNode icon={Wrench} title="2. deploy.sh" text="Esegue git pull, aggiorna le dipendenze, riavvia il backend e ricompila il frontend." tone="yellow" />
            <div className="ml-5 border-l-2 border-dashed border-gray-300 h-4" />
            <FlowNode icon={Server} title="3. VM" text="Nginx pubblica l'applicazione e systemd mantiene attivo il backend." tone="green" />
          </div>
          <div className="mt-4 rounded-lg bg-gray-900 text-gray-100 px-4 py-3 font-mono text-sm">
            /opt/lpw/deploy.sh
          </div>
        </Section>
      </div>

      <Section icon={ShieldCheck} title="Architettura multi-plant" subtitle="Separazione completa tra Induno e Luserna">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-5">
            <div className="flex items-center gap-2 text-blue-800 font-bold"><HardDrive size={19} /> Ambiente Induno</div>
            <div className="mt-4 space-y-2 text-sm text-blue-900">
              <div><strong>PLANT_ID:</strong> induno</div>
              <div><strong>Database attuale:</strong> sheetkaizen</div>
              <div><strong>Database futuro:</strong> lpw_induno</div>
              <div><strong>Infrastruttura finale:</strong> VM dedicata</div>
            </div>
          </div>
          <div className="rounded-xl border-2 border-purple-200 bg-purple-50 p-5">
            <div className="flex items-center gap-2 text-purple-800 font-bold"><HardDrive size={19} /> Ambiente Luserna</div>
            <div className="mt-4 space-y-2 text-sm text-purple-900">
              <div><strong>PLANT_ID:</strong> luserna</div>
              <div><strong>Database futuro:</strong> lpw_luserna</div>
              <div><strong>Infrastruttura finale:</strong> VM dedicata</div>
              <div><strong>Stato:</strong> non ancora attivato</div>
            </div>
          </div>
          <div className="rounded-xl border-2 border-green-200 bg-green-50 p-5">
            <div className="flex items-center gap-2 text-green-800 font-bold"><Users size={19} /> Accessi</div>
            <div className="mt-4 space-y-2 text-sm text-green-900">
              <div>Gli utenti standard accedono soltanto al proprio plant.</div>
              <div>Il Super Admin accede esplicitamente a entrambi gli ambienti.</div>
              <div>SSO e sottoruoli saranno definiti dopo la lista utenti.</div>
            </div>
          </div>
        </div>
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <LockKeyhole size={20} className="flex-shrink-0 mt-0.5" />
          <div>
            <strong>Regola fondamentale:</strong> un utente Luserna non deve vedere o modificare dati Induno e un utente Induno non deve vedere o modificare dati Luserna. La separazione finale utilizza VM, database, credenziali e configurazioni distinte.
          </div>
        </div>
      </Section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Section icon={CheckCircle2} title="Multi-plant implementato" subtitle="Moduli già adeguati e verificati">
          <ul className="space-y-3">
            {implementedModules.map(item => <StatusItem key={item} done>{item}</StatusItem>)}
          </ul>
        </Section>
        <Section icon={Route} title="Roadmap adeguamento" subtitle="Moduli operativi ancora da proteggere per plant">
          <ul className="space-y-3">
            {roadmapModules.map(item => <StatusItem key={item}>{item}</StatusItem>)}
          </ul>
        </Section>
      </div>

      <Section icon={Boxes} title="Dati, documenti e contenuti Corporate" subtitle="Cosa viene separato e cosa può essere riutilizzato">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl bg-gray-50 border p-4">
            <div className="font-bold text-gray-800 flex items-center gap-2"><Database size={17} /> Dati operativi</div>
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">Kaizen, Action Plan, Segnalazioni, OPL, Pillar, meeting, utenti e notifiche appartengono a un solo plant.</p>
          </div>
          <div className="rounded-xl bg-gray-50 border p-4">
            <div className="font-bold text-gray-800 flex items-center gap-2"><FileArchive size={17} /> File e immagini</div>
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">Gli upload sono archiviati in GridFS. Con database separati, anche i bucket file risultano separati fisicamente.</p>
          </div>
          <div className="rounded-xl bg-gray-50 border p-4">
            <div className="font-bold text-gray-800 flex items-center gap-2"><Cloud size={17} /> Template Corporate</div>
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">Route, metodologie e template ufficiali possono essere definiti come Corporate e utilizzati nei progetti locali.</p>
          </div>
        </div>
      </Section>

      <Section icon={KeyRound} title="Regole per lo sviluppo" subtitle="Checklist tecnica per nuove funzioni e modifiche">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
          {developmentRules.map(rule => (
            <div key={rule} className="flex items-start gap-2 text-sm text-gray-700">
              <ShieldCheck size={17} className="text-primary mt-0.5 flex-shrink-0" />
              <span>{rule}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section icon={Server} title="Stato infrastruttura Induno" subtitle="Configurazione attualmente validata">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ['Frontend', 'Nginx + build Vite', 'Operativo'],
            ['Backend', 'FastAPI + systemd', 'Operativo'],
            ['Database', 'MongoDB Atlas / sheetkaizen', 'Operativo'],
            ['Upload', 'GridFS immagini e documenti', 'Operativo'],
          ].map(([title, detail, status]) => (
            <div key={title} className="rounded-xl border border-green-200 bg-green-50 p-4">
              <div className="text-xs uppercase tracking-wide text-green-700">{title}</div>
              <div className="font-bold text-green-900 mt-1">{status}</div>
              <div className="text-xs text-green-800 mt-2">{detail}</div>
            </div>
          ))}
        </div>
      </Section>

      <div className="text-center text-xs text-gray-400">
        Documento tecnico interno LPW System · Stato aggiornato dopo la validazione multi-plant di Reparti, Quick/Standard Kaizen, Major Kaizen e Action Plan
      </div>
    </div>
  )
}
