import {
  BarChart3,
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
  'Segnalazioni Sicurezza e Ambiente',
  'OPL: setup, assegnazioni, conferme di lettura e report',
  'Pillar, analisi e cartelle',
  'Dashboard e duplicazione',
  'Notifiche',
  'Configurazioni con classificazione Corporate / Plant',
  'Catalogo Route con visibilità Corporate / Plant',
]

const roadmapModules = [
  'Audit finale query MongoDB (in corso: Skill Matrix da adeguare)',
  'Utenti e autorizzazioni con Keycloak',
  'Frazionamento VM: istanza Induno e istanza Luserna',
  'MongoDB su cloud aziendale al posto di Atlas',
  'Migrazione database sheetkaizen → lpw_induno',
  'Attivazione ambiente Luserna (lpw_luserna)',
  'ETL verso Snowflake e report cross-plant',
]

const reviewModules = [
  'Documenti: interfaccia, ricerca, versioni',
  'Upload e GridFS: immagini e allegati',
  'Preview Excel e immagini incorporate',
  'Servizio di conversione documenti sulla VM',
  'Importazione OPL storiche',
  'Ottimizzazione caricamento frontend (code splitting)',
]

const developmentRules = [
  'Il frontend non decide mai il plant operativo.',
  'Il backend assegna il plant tramite settings.PLANT_ID.',
  'Ogni query operativa deve essere limitata al plant corrente.',
  'I record storici senza plant_id sono considerati Induno durante la transizione.',
  'I collegamenti tra entità sono consentiti soltanto nello stesso plant.',
  'Le configurazioni Corporate hanno scope corporate e vanno copiate identiche su ogni plant.',
  'Le Route Corporate sono visibili a tutti i plant, le Route di plant solo localmente.',
  'Le modifiche vengono distribuite da una sola codebase GitHub.',
  "L'applicazione legge e scrive solo su MongoDB; Snowflake riceve copie via ETL.",
]

const corporateTypes = [
  'stato_ap',
  'priorita_ap',
  'ap_5m',
  'tipi_action_plan',
  'categorie_perdita',
  'cluster_perdita',
  'categoria_skill',
  'categorie_documento',
]

const plantTypes = [
  'area_opl',
  'tipo_opl',
  'argomenti',
  'tipi_meeting',
  'categoria_segnalazione_sicurezza',
  'categoria_segnalazione_ambiente',
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
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
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

function StatusItem({ children, done = false, tone = 'gray' }) {
  const color = done ? 'text-green-600' : tone === 'amber' ? 'text-amber-500' : 'text-gray-300'
  return (
    <li className="flex items-start gap-2 text-sm text-gray-700">
      <CheckCircle2 size={17} className={`${color} mt-0.5 flex-shrink-0`} />
      <span>{children}</span>
    </li>
  )
}

function Arrow() {
  return <div className="ml-5 border-l-2 border-dashed border-gray-300 h-4" />
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
              Stato dell'architettura applicativa, deploy sulla VM, isolamento multi-plant, autenticazione,
              flusso dati verso Snowflake e regole tecniche da rispettare durante lo sviluppo.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 min-w-full lg:min-w-80">
            <div className="bg-white bg-opacity-10 rounded-xl p-3">
              <div className="text-xs opacity-75">Plant attivo</div>
              <div className="font-bold mt-1">Induno</div>
            </div>
            <div className="bg-white bg-opacity-10 rounded-xl p-3">
              <div className="text-xs opacity-75">Stato</div>
              <div className="font-bold mt-1">Multi-plant predisposto</div>
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
            <FlowNode icon={Database} title="Database" text="MongoDB con Motor/PyMongo e GridFS per file e immagini. Oggi su Atlas, in futuro su cloud aziendale." tone="purple" />
          </div>
        </Section>

        <Section icon={GitBranch} title="Flusso di deploy" subtitle="Una sola codebase per tutti gli ambienti">
          <div className="space-y-3">
            <FlowNode icon={GitBranch} title="1. GitHub" text="Repository privati frontend e backend LPW System, accesso VM con token in sola lettura." tone="blue" />
            <Arrow />
            <FlowNode icon={Wrench} title="2. deploy.sh" text="Esegue git pull, aggiorna le dipendenze, riavvia il backend e ricompila il frontend." tone="yellow" />
            <Arrow />
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
              <div><strong>Infrastruttura:</strong> partizione Induno della VM</div>
              <div><strong>URL previsto:</strong> lpw-system-induno.it.lindt.net</div>
            </div>
          </div>
          <div className="rounded-xl border-2 border-purple-200 bg-purple-50 p-5">
            <div className="flex items-center gap-2 text-purple-800 font-bold"><HardDrive size={19} /> Ambiente Luserna</div>
            <div className="mt-4 space-y-2 text-sm text-purple-900">
              <div><strong>PLANT_ID:</strong> luserna</div>
              <div><strong>Database futuro:</strong> lpw_luserna</div>
              <div><strong>Infrastruttura:</strong> partizione Luserna della VM</div>
              <div><strong>URL previsto:</strong> lpw-system-luserna.it.lindt.net</div>
              <div><strong>Stato:</strong> non ancora attivato</div>
            </div>
          </div>
          <div className="rounded-xl border-2 border-green-200 bg-green-50 p-5">
            <div className="flex items-center gap-2 text-green-800 font-bold"><Users size={19} /> Accessi</div>
            <div className="mt-4 space-y-2 text-sm text-green-900">
              <div>Gli utenti standard accedono soltanto al proprio plant.</div>
              <div>Il Super Admin accede esplicitamente a entrambi gli ambienti.</div>
              <div>Sottoruoli per plant definiti dopo la lista utenti.</div>
            </div>
          </div>
        </div>
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <LockKeyhole size={20} className="flex-shrink-0 mt-0.5" />
          <div>
            <strong>Regola fondamentale:</strong> un utente Luserna non deve vedere o modificare dati Induno e un utente Induno non deve vedere o modificare dati Luserna. La separazione usa istanze applicative, database, credenziali e configurazioni distinte; plant_id è la seconda barriera nel codice.
          </div>
        </div>
      </Section>

      <Section icon={Server} title="Infrastruttura target" subtitle="VM frazionata e database su cloud aziendale">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <FlowNode icon={Server} title="VM frazionata" text="Una partizione per Induno e una per Luserna: servizio backend, file .env, build frontend e configurazione Nginx separati." tone="green" />
            <FlowNode icon={Network} title="Nginx" text="Due virtual host, uno per URL di plant, ciascuno instradato al proprio backend." tone="yellow" />
          </div>
          <div className="space-y-3">
            <FlowNode icon={Database} title="MongoDB su cloud aziendale" text="Sostituisce MongoDB Atlas. Database lpw_induno e lpw_luserna con credenziali distinte." tone="purple" />
            <FlowNode icon={ShieldCheck} title="Sequenza" text="Prima stabilizzazione e migrazione Induno, poi attivazione Luserna. Mai le due attività insieme." tone="gray" />
          </div>
        </div>
      </Section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Section icon={KeyRound} title="Autenticazione con Keycloak" subtitle="Stesso modello del MES con ACS">
          <div className="space-y-3">
            <FlowNode icon={Users} title="Identity Provider" text="Keycloak gestisce login e utenti, alimentato da Entra ID e SAP HR. LPW non gestisce più password proprie." tone="blue" />
            <Arrow />
            <FlowNode icon={KeyRound} title="Token OIDC" text="LPW è un client Keycloak. Il backend verifica il token e legge plant e ruoli da gruppi o claim." tone="yellow" />
            <Arrow />
            <FlowNode icon={ShieldCheck} title="Autorizzazione" text="Ogni istanza accetta solo utenti autorizzati per il proprio plant. Il gruppo super admin accede a entrambe." tone="green" />
          </div>
        </Section>

        <Section icon={BarChart3} title="Flusso dati verso Snowflake" subtitle="Database operativo e data warehouse separati">
          <div className="space-y-3">
            <FlowNode icon={Code2} title="LPW System" text="Legge e scrive in tempo reale solo su MongoDB." tone="blue" />
            <Arrow />
            <FlowNode icon={Database} title="MongoDB per plant" text="Database operativo isolato: lpw_induno e lpw_luserna." tone="purple" />
            <Arrow />
            <FlowNode icon={Cloud} title="ETL periodico" text="Copia i dati di entrambi i plant aggiungendo la colonna plant." tone="yellow" />
            <Arrow />
            <FlowNode icon={BarChart3} title="Snowflake e Power BI" text="Analisi e report cross-plant per il livello corporate. Nessuna scrittura verso l'applicazione." tone="green" />
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Section icon={CheckCircle2} title="Multi-plant implementato" subtitle="Moduli adeguati e verificati">
          <ul className="space-y-3">
            {implementedModules.map(item => <StatusItem key={item} done>{item}</StatusItem>)}
          </ul>
        </Section>
        <Section icon={Route} title="Roadmap" subtitle="Prossime attività in ordine">
          <ul className="space-y-3">
            {roadmapModules.map(item => <StatusItem key={item}>{item}</StatusItem>)}
          </ul>
        </Section>
        <Section icon={FileArchive} title="Da rivedere integralmente" subtitle="Predisposto multi-plant, non ancora validato">
          <ul className="space-y-3">
            {reviewModules.map(item => <StatusItem key={item} tone="amber">{item}</StatusItem>)}
          </ul>
        </Section>
      </div>

      <Section icon={Boxes} title="Configurazioni Corporate e di Plant" subtitle="Classificazione dei tipi di configurazione">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
            <div className="font-bold text-blue-800">Corporate</div>
            <p className="text-xs text-blue-700 mt-1">Liste identiche su tutti i plant, da copiare uguali all'attivazione di un nuovo plant.</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {corporateTypes.map(t => (
                <span key={t} className="text-xs font-mono bg-white border border-blue-200 rounded px-2 py-1 text-blue-800">{t}</span>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-green-50 border border-green-200 p-4">
            <div className="font-bold text-green-800">Plant</div>
            <p className="text-xs text-green-700 mt-1">Voci specifiche di ogni stabilimento, gestite localmente.</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {plantTypes.map(t => (
                <span key={t} className="text-xs font-mono bg-white border border-green-200 rounded px-2 py-1 text-green-800">{t}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="rounded-xl bg-gray-50 border p-4">
            <div className="font-bold text-gray-800 flex items-center gap-2"><FileArchive size={17} /> File e immagini</div>
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">Gli upload sono archiviati in GridFS con plant_id nei metadati. Con database separati anche i file risultano separati fisicamente.</p>
          </div>
          <div className="rounded-xl bg-gray-50 border p-4">
            <div className="font-bold text-gray-800 flex items-center gap-2"><Route size={17} /> Route Major Kaizen</div>
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">Le Route Corporate sono template condivisi; ogni Major salva uno snapshot congelato nel proprio plant.</p>
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
            ['Repository', 'GitHub privati + token lpw-vm', 'Operativo'],
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
        Documento tecnico interno LPW System · Aggiornato dopo la predisposizione multi-plant dei moduli operativi, la decisione Keycloak e il piano di infrastruttura
      </div>
    </div>
  )
}
