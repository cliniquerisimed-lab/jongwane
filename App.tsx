
import React, { useState, useEffect, useRef } from 'react';
import { SectionTopic, DocumentId, DocumentData } from './types';
import { askGeminiExpert, generateSpeech } from './services/geminiService';

// --- Composants UI ---

const NoteArea: React.FC<{ 
  docId: string; 
  secId: string; 
  value: string; 
  onChange: (val: string) => void 
}> = ({ value, onChange }) => {
  return (
    <div className="mt-6 no-print">
      <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-amber-800 mb-2 px-1">
        Annotations de l'Auditeur (Sauvegarde automatique)
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ajoutez vos réflexions critiques ici..."
        className="w-full min-h-[120px] p-4 bg-amber-50/40 border-2 border-dashed border-amber-300 rounded-xl text-sm focus:border-solid focus:border-[#003366] transition-all font-inter shadow-inner focus:bg-white"
      />
    </div>
  );
};

const LoadingOverlay: React.FC = () => (
  <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center rounded-2xl animate-in fade-in duration-500">
    <div className="relative w-20 h-20 mb-8">
      <div className="absolute inset-0 border-4 border-[#003366]/10 rounded-full"></div>
      <div className="absolute inset-0 border-4 border-[#003366] border-t-transparent rounded-full animate-spin"></div>
      <div className="absolute inset-4 bg-amber-400/20 rounded-full animate-pulse flex items-center justify-center">
        <svg className="w-6 h-6 text-[#003366]" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"/></svg>
      </div>
    </div>
    <h3 className="text-[#003366] font-serif text-xl font-bold mb-2">Expertise IA en cours...</h3>
    <p className="text-slate-500 text-sm font-medium animate-pulse text-center px-6">L'IA Dr JONGWANE analyse votre document.<br/>Veuillez patienter quelques instants.</p>
  </div>
);

interface AIProps {
  docId: string;
  topic: SectionTopic;
  baseText: string;
  onRegenerate: () => void;
  onClose: () => void;
  responseHtml: string;
  isLoading: boolean;
  audioBuffer: AudioBuffer | null;
}

const AIResponseBox: React.FC<AIProps> = ({ docId, topic, baseText, onRegenerate, onClose, responseHtml, isLoading, audioBuffer }) => {
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<string>(responseHtml || '');
  const [isAsking, setIsAsking] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    if (responseHtml) setChatHistory(responseHtml);
  }, [responseHtml]);

  useEffect(() => {
    if (audioBuffer && !isLoading) playAudio();
    // Cleanup audio on unmount or close
    return () => stopAudio();
  }, [audioBuffer, isLoading]);

  const stopAudio = () => {
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch (e) {}
      audioSourceRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (e) {}
      audioContextRef.current = null;
    }
  };

  const playAudio = () => {
    stopAudio();
    if (!audioBuffer) return;
    
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = ctx;
    
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.start(0);
    audioSourceRef.current = source;
  };

  const handleClose = () => {
    stopAudio();
    onClose();
  };

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    setIsAsking(true);
    const result = await askGeminiExpert(docId, topic, baseText, question);
    setChatHistory(result.text);
    setQuestion('');
    setIsAsking(false);
    
    const newAudio = await generateSpeech(result.text.replace(/<[^>]*>/g, ''));
    if (newAudio) {
      stopAudio();
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;
      const source = ctx.createBufferSource();
      source.buffer = newAudio;
      source.connect(ctx.destination);
      source.start(0);
      audioSourceRef.current = source;
    }
  };

  if (!responseHtml && !isLoading) return null;

  return (
    <div className="h-full flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-500 font-inter no-print relative">
      {isLoading && <LoadingOverlay />}
      <div className="bg-[#003366] px-6 py-4 flex items-center justify-between shadow-md z-10">
        <div className="flex items-center gap-3">
          <div className="bg-amber-400 p-1.5 rounded-lg">
            <svg className="w-4 h-4 text-[#003366]" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"/></svg>
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Expertise IA Vocale Intégrale</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={playAudio} className="p-2 text-blue-200 hover:text-white" title="Réécouter l'intégralité"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"/></svg></button>
          <button onClick={onRegenerate} className="p-2 text-blue-200 hover:text-white" title="Relancer l'analyse"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg></button>
          <button onClick={handleClose} className="p-2 text-blue-200 hover:text-red-400" title="Fermer et arrêter la voix"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg></button>
        </div>
      </div>
      <div className="p-7 flex-1 overflow-y-auto min-h-[350px]">
        {!isLoading && (
          <>
            <div className="ai-content text-[15px] text-slate-800 leading-relaxed font-inter" dangerouslySetInnerHTML={{ __html: (chatHistory || "").replace(/\n\n/g, '</div><div class="mt-5">') }} />
            <form onSubmit={handleAsk} className="mt-8 pt-6 border-t border-slate-100 flex gap-3 no-print">
              <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Posez une question à l'IA..." className="flex-1 bg-slate-50 border-none rounded-full px-5 py-3 text-sm focus:ring-2 focus:ring-[#003366] transition-all shadow-inner" />
              <button type="submit" disabled={isAsking} className="bg-[#003366] text-white px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-black transition-all shadow-lg disabled:opacity-50">Discuter</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

// --- Données Initiales avec Textes Intégraux ---

const INITIAL_DOCUMENTS: Record<string, DocumentData> = {
  sphinx: {
    id: 'sphinx' as DocumentId,
    title: 'Audit Stratégique Sphinx',
    subtitle: 'Cabinet SPHINX Consulting',
    sections: {
      forces: {
        title: 'Analyse de l\'Identité & Forces',
        content: (
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 uppercase text-xs tracking-wider">Texte de référence</h3>
            <p>SPHINX Consulting est un cabinet de conseil pluridisciplinaire spécialisé dans l’accompagnement stratégique des institutions publiques, organisations internationales, ONG, associations et structures privées à impact social.</p>
          </div>
        ),
        rawText: "SPHINX Consulting est un cabinet de conseil pluridisciplinaire spécialisé dans l’accompagnement stratégique des institutions publiques, organisations internationales, ONG, associations et structures privées à impact social. Le cabinet intervient principalement dans les domaines de la santé publique, du développement humain, de l’économie appliquée et de la gouvernance des projets et politiques publiques."
      },
      faiblesses: {
        title: 'Domaines & Évaluation des Risques',
        content: (
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 uppercase text-xs tracking-wider">Texte de référence</h3>
            <p>Dans un contexte marqué par des ressources limitées, des besoins sociaux croissants et des exigences accrues des partenaires techniques et financiers, SPHINX Consulting se positionne comme un acteur de référence.</p>
          </div>
        ),
        rawText: "Dans un contexte marqué par des ressources limitées, des besoins sociaux croissants et des exigences accrues des partenaires techniques et financiers, SPHINX Consulting se positionne comme un acteur de référence offrant des solutions adaptées, rigoureuses et orientées vers l’impact."
      },
      propositions: {
        title: 'Propositions & Grille Tarifaire',
        content: (
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 uppercase text-xs tracking-wider">Texte de référence</h3>
            <p>La tarification du cabinet s'étend de 1 800 000 FCFA à 9 000 000 FCFA selon la complexité des études stratégiques et économiques.</p>
          </div>
        ),
        rawText: "6. GRILLE TARIFAIRE INDICATIVE : Diagnostic sectoriel (1 800 000 – 6 000 000), Étude économique (3 000 000 – 9 000 000), Audit organisationnel (1 800 000 – 4 800 000). 8. POLITIQUE DE RÉMUNÉRATION : Directeur (Variable), RAF (480 000 – 900 000), Responsable technique (720 000 – 1 200 000)."
      }
    },
    originalRef: (
      <div className="prose prose-slate max-w-none space-y-6 font-inter text-slate-700 leading-relaxed text-sm p-6 bg-white rounded-xl shadow-inner border border-slate-100">
        <header className="text-center border-b border-slate-200 pb-8 mb-8">
            <h1 className="text-3xl font-serif text-[#003366] uppercase mb-1">SPHINX CONSULTING</h1>
            <p className="text-[#C0A062] font-bold uppercase tracking-widest text-xs">Cabinet de conseil stratégique, santé publique et développement</p>
        </header>

        <section>
            <h2 className="text-lg font-bold text-[#003366] border-b pb-2 mb-4">1. PRÉSENTATION GÉNÉRALE</h2>
            <p>SPHINX Consulting est un cabinet de conseil pluridisciplinaire spécialisé dans l’accompagnement stratégique des institutions publiques, organisations internationales, ONG, associations et structures privées à impact social. Le cabinet intervient principalement dans les domaines de la santé publique, du développement humain, de l’économie appliquée et de la gouvernance des projets et politiques publiques.</p>
            <p className="mt-4">Dans un contexte marqué par des ressources limitées, des besoins sociaux croissants et des exigences accrues des partenaires techniques et financiers, SPHINX Consulting se positionne comme un acteur de référence offrant des solutions adaptées, rigoureuses et orientées vers l’impact.</p>
        </section>

        <section>
            <h2 className="text-lg font-bold text-[#003366] border-b pb-2 mb-4">2. VISION, MISSION ET VALEURS</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h3 className="font-bold text-slate-900 mb-2">Vision</h3>
                    <p>Contribuer durablement à l’amélioration des systèmes sociaux et sanitaires par un conseil stratégique fondé sur l’expertise, l’innovation et l’équité.</p>
                </div>
                <div>
                    <h3 className="font-bold text-slate-900 mb-2">Mission</h3>
                    <p>Appuyer les décideurs et les organisations dans la conception, la mise en œuvre et l’évaluation de politiques, programmes et projets à fort impact social, en tenant compte des réalités locales et des standards internationaux.</p>
                </div>
            </div>
            <div className="mt-6">
                <h3 className="font-bold text-slate-900 mb-2">Valeurs</h3>
                <ul className="grid grid-cols-2 gap-2 list-none p-0">
                    <li className="flex items-center gap-2"> <span className="text-amber-500">•</span> Excellence technique et scientifique</li>
                    <li className="flex items-center gap-2"> <span className="text-amber-500">•</span> Éthique et intégrité professionnelle</li>
                    <li className="flex items-center gap-2"> <span className="text-amber-500">•</span> Approche contextuelle et participative</li>
                    <li className="flex items-center gap-2"> <span className="text-amber-500">•</span> Orientation résultats et impact</li>
                </ul>
            </div>
        </section>

        <section>
            <h2 className="text-lg font-bold text-[#003366] border-b pb-2 mb-4">3. DOMAINES D’INTERVENTION ET ACTIVITÉS</h2>
            <div className="space-y-4">
                <p><strong>3.1 Conseil en santé publique :</strong> Diagnostics, Politiques sanitaires, CSU.</p>
                <p><strong>3.2 Économie de la santé :</strong> Études coût-efficacité, soutenabilité financière.</p>
                <p><strong>3.3 Montage et gestion de projets :</strong> Notes conceptuelles, S&E, théories du changement.</p>
                <p><strong>3.4 Recherche appliquée :</strong> Études de faisabilité, recherche opérationnelle.</p>
                <p><strong>3.5 Appui institutionnel :</strong> Audit organisationnel, décentralisation.</p>
            </div>
        </section>

        <section>
            <h2 className="text-lg font-bold text-[#003366] border-b pb-2 mb-4">6. GRILLE TARIFAIRE INDICATIVE</h2>
            <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse border border-slate-200">
                    <thead className="bg-[#003366] text-white">
                        <tr><th className="p-3 border border-slate-200">Prestation</th><th className="p-3 border border-slate-200">Tarif (FCFA)</th></tr>
                    </thead>
                    <tbody>
                        <tr><td className="p-3 border">Diagnostic sectoriel / étude stratégique</td><td className="p-3 border font-bold">1 800 000 – 6 000 000</td></tr>
                        <tr><td className="p-3 border">Étude économique (impact)</td><td className="p-3 border font-bold">3 000 000 – 9 000 000</td></tr>
                        <tr><td className="p-3 border">Élaboration de projet / note conceptuelle</td><td className="p-3 border font-bold">900 000 – 2 400 000</td></tr>
                        <tr><td className="p-3 border">Audit organisationnel</td><td className="p-3 border font-bold">1 800 000 – 4 800 000</td></tr>
                    </tbody>
                </table>
            </div>
        </section>

        <section>
            <h2 className="text-lg font-bold text-[#003366] border-b pb-2 mb-4">9. CODE D’ÉTHIQUE ET DE CONDUITE</h2>
            <ol className="list-decimal pl-5 space-y-2 font-bold text-[#003366]">
                <li>Intégrité : Tolérance zéro corruption.</li>
                <li>Confidentialité : Protection stricte des données.</li>
                <li>Objectivité : Indépendance des analyses.</li>
                <li>Équité : Promotion active de l'approche genre.</li>
            </ol>
        </section>
      </div>
    )
  },
  'echo-pediatrie': {
    id: 'echo-pediatrie' as DocumentId,
    title: 'Audit Projet Écho-Pédiatrie',
    subtitle: 'Association Aide Médicale x Padre Pio',
    sections: {
      forces: {
        title: 'Pertinence & Objectifs du Projet',
        content: (
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 uppercase text-xs tracking-wider">Texte de référence</h3>
            <p>Améliorer durablement la prise en charge des urgences pédiatriques à l’Hôpital Catholique Padre Pio grâce à l’utilisation structurée de l’échographie clinique (POCUS).</p>
          </div>
        ),
        rawText: "L’Hôpital Catholique Padre Pio accueille environ 1 000 enfants par mois. Objectif : Améliorer durablement la prise en charge des urgences pédiatriques grâce à l’utilisation structurée de l’échographie clinique au lit du patient (POCUS)."
      },
      faiblesses: {
        title: 'Problématique & Risques',
        content: (
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 uppercase text-xs tracking-wider">Texte de référence</h3>
            <p>Retards diagnostiques dans les urgences vitales. Dépendance à des examens coûteux ou indisponibles et manque de personnel formé à l'échographie pédiatrique.</p>
          </div>
        ),
        rawText: "Retards diagnostiques, difficultés de triage des nouveau-nés graves, dépendance à des examens coûteux, insuffisance de personnel formé, risque de mortalité évitable."
      },
      propositions: {
        title: 'Budget & Pérennisation',
        content: (
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 uppercase text-xs tracking-wider">Texte de référence</h3>
            <p>Budget total de 12 000 000 FCFA incluant deux échographes portables et la formation intensive du personnel avec mentorat clinique.</p>
          </div>
        ),
        rawText: "Budget : 12 000 000 FCFA. Activités : Acquisition matériel (9M), Formation (1.5M), Aménagement (0.5M), Suivi-Évaluation (1M). Pérennisation par quote-part symbolique (tarif social) pour maintenance."
      }
    },
    originalRef: (
      <div className="prose prose-slate max-w-none space-y-6 font-inter text-slate-700 leading-relaxed text-sm p-6 bg-white rounded-xl shadow-inner border border-slate-100">
        <header className="text-center border-b border-slate-200 pb-8 mb-8">
            <p className="text-[#C0A062] font-black uppercase tracking-[0.4em] text-[10px] mb-1">PROJET DE SANTÉ HOSPITALIER</p>
            <h1 className="text-2xl md:text-3xl font-serif text-[#003366] uppercase mb-4">Écho-Pédiatrie : Sauver des Vies par l'Innovation</h1>
            <div className="flex flex-wrap justify-center gap-6 text-[11px] text-slate-500 font-bold uppercase tracking-widest">
                <span>Porteur : Association Aide Médicale</span>
                <span>Partenaire : Hôpital Catholique Padre Pio</span>
                <span>Localisation : Douala</span>
                <span>Février 2026</span>
            </div>
        </header>

        <section>
            <h2 className="text-lg font-bold text-[#003366] border-b pb-2 mb-4">1. PRÉSENTATION DE L’ÉTABLISSEMENT</h2>
            <p>L’Hôpital Catholique Padre Pio est une structure sanitaire à forte vocation sociale et humanitaire, accueillant en moyenne 1 000 enfants par mois, répartis entre nouveaux-nés, nourrissons et enfants. Les urgences pédiatriques constituent un service stratégique de l’hôpital.</p>
        </section>

        <section>
            <h2 className="text-lg font-bold text-[#003366] border-b pb-2 mb-4">2. CONTEXTE ET JUSTIFICATION</h2>
            <p>Urgences pédiatriques marquées par une charge élevée de pathologies infectieuses et respiratoires. L’échographie clinique au lit du patient (POCUS) représente une solution clé : non invasive, sans irradiation, rapide et peu coûteuse.</p>
        </section>

        <section>
            <h2 className="text-lg font-bold text-[#003366] border-b pb-2 mb-4">3. PROBLÉMATIQUE</h2>
            <ul className="list-disc pl-5 space-y-2">
                <li>Retards diagnostiques dans les urgences vitales.</li>
                <li>Difficultés de triage rapide des nouveau-nés graves.</li>
                <li>Dépendance à des examens coûteux ou indisponibles.</li>
                <li>Insuffisance de personnel formé à l’échographie pédiatrique.</li>
            </ul>
        </section>

        <section>
            <h2 className="text-lg font-bold text-[#003366] border-b pb-2 mb-4">7. BUDGET PRÉVISIONNEL ESTIMATIF</h2>
            <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse border border-slate-200">
                    <thead className="bg-[#003366] text-white">
                        <tr><th className="p-3 border">Poste</th><th className="p-3 border">Description</th><th className="p-3 border">Montant (FCFA)</th></tr>
                    </thead>
                    <tbody>
                        <tr><td className="p-3 border">Équipements</td><td className="p-3 border">02 Échographes portables + Sondes</td><td className="p-3 border font-bold">9 000 000</td></tr>
                        <tr><td className="p-3 border">Formation</td><td className="p-3 border">Experts formateurs (5 jours)</td><td className="p-3 border font-bold">1 500 000</td></tr>
                        <tr><td className="p-3 border">Aménagement</td><td className="p-3 border">Sécurisation et stockage</td><td className="p-3 border font-bold">500 000</td></tr>
                        <tr><td className="p-3 border">Suivi-Éval</td><td className="p-3 border">Collecte de données (1 an)</td><td className="p-3 border font-bold">1 000 000</td></tr>
                        <tr className="bg-slate-50 font-bold"><td colSpan={2} className="p-3 border">TOTAL GÉNÉRAL</td><td className="p-3 border text-[#003366]">12 000 000 FCFA</td></tr>
                    </tbody>
                </table>
            </div>
        </section>

        <section>
            <h2 className="text-lg font-bold text-[#003366] border-b pb-2 mb-4">9. PÉRENNISATION DU PROJET</h2>
            <p>Une quote-part symbolique sur chaque examen (tarif social) sera perçue pour constituer un fonds de maintenance des appareils. La formation sera intégrée au cursus d'accueil de tout nouveau personnel soignant.</p>
        </section>
      </div>
    )
  }
};

const App: React.FC = () => {
  const [documents, setDocuments] = useState<Record<string, DocumentData>>(INITIAL_DOCUMENTS);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'audit' | 'original'>('audit');
  const [aiResponses, setAiResponses] = useState<Record<string, Record<string, string>>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [audioBuffers, setAudioBuffers] = useState<Record<string, AudioBuffer | null>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDocData, setNewDocData] = useState({ title: '', subtitle: '', text: '' });

  useEffect(() => {
    const saved = localStorage.getItem('dr_jongwane_audit_data_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.aiResponses) setAiResponses(parsed.aiResponses);
        if (parsed.notes) setNotes(parsed.notes);
        if (parsed.customDocs) setDocuments(prev => ({ ...prev, ...parsed.customDocs }));
      } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    const customDocs = Object.fromEntries(
      Object.entries(documents).filter(([key]) => key !== 'sphinx' && key !== 'echo-pediatrie')
    );
    localStorage.setItem('dr_jongwane_audit_data_v3', JSON.stringify({ aiResponses, notes, customDocs }));
  }, [aiResponses, notes, documents]);

  const handleAIRequest = async (topic: SectionTopic, customPrompt?: string) => {
    if (!selectedDoc || loading[topic]) return;
    setLoading(prev => ({ ...prev, [topic]: true }));
    
    const doc = documents[selectedDoc];
    const baseText = doc.sections[topic].rawText;

    try {
      const result = await askGeminiExpert(selectedDoc, topic, baseText, customPrompt);
      setAiResponses(prev => ({
        ...prev,
        [selectedDoc]: { ...(prev[selectedDoc] || {}), [topic]: result.text }
      }));
      // Lecture automatique dès la génération
      const audio = await generateSpeech(result.text.replace(/<[^>]*>/g, ''));
      setAudioBuffers(prev => ({ ...prev, [topic]: audio }));
    } catch (err) { 
      alert("Une erreur est survenue lors de l'analyse."); 
    } finally {
      setLoading(prev => ({ ...prev, [topic]: false }));
    }
  };

  const closeAI = (topic: string) => {
    if (!selectedDoc) return;
    setAiResponses(prev => {
      const docResps = { ...(prev[selectedDoc] || {}) };
      delete docResps[topic];
      return { ...prev, [selectedDoc]: docResps };
    });
    setAudioBuffers(prev => {
      const copy = { ...prev };
      delete copy[topic];
      return copy;
    });
  };

  const handleAddDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocData.title || !newDocData.text) return;
    
    const newId = `custom-${Date.now()}` as any;
    const created: DocumentData = {
      id: newId,
      title: newDocData.title,
      subtitle: newDocData.subtitle || 'Dossier Utilisateur',
      sections: {
        forces: { title: 'Points Forts', content: <p className="italic text-slate-400">Analyse IA requise...</p>, rawText: newDocData.text },
        faiblesses: { title: 'Risques & Lacunes', content: <p className="italic text-slate-400">Analyse IA requise...</p>, rawText: newDocData.text },
        propositions: { title: 'Solutions Stratégiques', content: <p className="italic text-slate-400">Analyse IA requise...</p>, rawText: newDocData.text }
      },
      originalRef: (
        <div className="p-8 bg-white border border-slate-200 rounded-2xl shadow-inner whitespace-pre-wrap font-inter text-sm leading-relaxed text-slate-700">
            <h2 className="text-xl font-serif text-[#003366] mb-6 border-b pb-4 uppercase">{newDocData.title}</h2>
            {newDocData.text}
        </div>
      )
    };
    
    setDocuments(prev => ({ ...prev, [newId]: created }));
    setSelectedDoc(newId);
    setShowAddForm(false);
    setNewDocData({ title: '', subtitle: '', text: '' });
  };

  if (!selectedDoc) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 font-inter">
        <div className="mb-12 text-center animate-in fade-in slide-in-from-top-4 duration-700">
          <h1 className="text-4xl md:text-6xl font-serif text-[#003366] mb-4 uppercase tracking-tighter">AUDIT EXPERT Dr JONGWANE</h1>
          <h2 className="text-xl md:text-2xl font-serif text-[#C0A062] uppercase italic">Intelligence Artificielle & Conseil de Haut Niveau</h2>
          <div className="w-24 h-1.5 bg-[#C0A062] mx-auto rounded-full mt-6 shadow-sm"></div>
        </div>
        
        <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {Object.values(documents).map((doc) => (
            <div key={doc.id} className="group bg-white p-10 rounded-[2.5rem] shadow-2xl border-t-[10px] border-[#003366] flex flex-col items-center text-center transition-all hover:scale-[1.03] hover:shadow-blue-200/50">
              <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-8 text-4xl shadow-inner">
                {doc.id.toString().includes('custom') ? '📄' : (doc.id === 'sphinx' ? '🏛️' : '🏥')}
              </div>
              <h2 className="font-serif text-2xl text-[#003366] mb-6 h-16 overflow-hidden leading-tight">{doc.title}</h2>
              <button onClick={() => setSelectedDoc(doc.id)} className="mt-auto w-full bg-[#003366] text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-black transition-all shadow-lg active:scale-95">Expertiser le Dossier</button>
            </div>
          ))}
          
          <button 
            onClick={() => setShowAddForm(true)}
            className="group bg-slate-50 border-4 border-dashed border-slate-300 p-10 rounded-[2.5rem] flex flex-col items-center justify-center text-center transition-all hover:border-[#003366] hover:bg-white hover:shadow-xl"
          >
            <div className="text-5xl mb-6 text-slate-300 group-hover:text-amber-500 transition-colors animate-bounce">➕</div>
            <span className="font-bold text-slate-500 group-hover:text-[#003366] text-lg">Nouveau Document</span>
            <p className="text-slate-400 text-xs mt-2 group-hover:text-slate-600">Texte libre ou document brut</p>
          </button>
        </div>

        {showAddForm && (
          <div className="fixed inset-0 bg-[#003366]/60 z-[200] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-3xl rounded-[2.5rem] p-10 shadow-2xl relative animate-in slide-in-from-bottom-10">
              <button onClick={() => setShowAddForm(false)} className="absolute top-8 right-8 text-slate-300 hover:text-red-500 text-3xl transition-colors">✕</button>
              <h2 className="text-3xl font-serif text-[#003366] mb-8 border-b pb-4">Soumission de Nouveau Dossier</h2>
              <form onSubmit={handleAddDocument} className="space-y-6">
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Titre du Projet / Client</label>
                    <input required placeholder="Ex: Plan Stratégique SPHINX 2026" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-[#003366] transition-all" value={newDocData.title} onChange={e => setNewDocData({...newDocData, title: e.target.value})} />
                </div>
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Contenu intégral à analyser</label>
                    <textarea required placeholder="Collez ici le texte complet de votre projet..." rows={12} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-[#003366] transition-all" value={newDocData.text} onChange={e => setNewDocData({...newDocData, text: e.target.value})}></textarea>
                </div>
                <button type="submit" className="w-full bg-[#003366] text-white py-5 rounded-2xl font-bold uppercase tracking-widest hover:bg-black shadow-xl transition-all transform active:scale-95">
                  Lancer l'Expertise IA
                </button>
              </form>
            </div>
          </div>
        )}
        
        <p className="mt-16 text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-3">
          <span>Dr JONGWANE</span> <span className="text-amber-500">•</span> <span>SERVICE D'AUDIT STRATÉGIQUE</span> <span className="text-amber-500">•</span> <span>2026</span>
        </p>
      </div>
    );
  }

  const currentDoc = documents[selectedDoc];
  const currentResponses = aiResponses[selectedDoc] || {};

  return (
    <div className="min-h-screen py-8 md:py-16 px-4 bg-[#f1f5f9] font-inter">
      <button onClick={() => setSelectedDoc(null)} className="no-print fixed bottom-12 left-12 z-[150] bg-white text-[#003366] px-8 py-4 rounded-full shadow-2xl font-bold border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all flex items-center gap-3">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
        Retour Menu
      </button>
      
      <div className="document-container max-w-[210mm] mx-auto bg-white p-6 md:p-[25mm_22mm] shadow-2xl relative border-t-[18px] border-[#003366] rounded-t-[3rem] overflow-hidden">
        <header className="text-center mb-10 border-b border-slate-100 pb-10">
          <h1 className="font-serif text-[#003366] text-4xl md:text-5xl uppercase tracking-tighter mb-4 leading-tight">{currentDoc.title}</h1>
          <div className="inline-block px-6 py-2 bg-slate-50 border border-slate-200 rounded-full text-[#C0A062] font-black text-[10px] uppercase tracking-[0.4em] shadow-sm">{currentDoc.subtitle}</div>
        </header>

        <nav className="no-print flex justify-center mb-16 border-b border-slate-100">
          <button onClick={() => setActiveTab('audit')} className={`px-10 py-5 text-xs font-bold uppercase tracking-widest relative transition-colors ${activeTab === 'audit' ? 'text-[#003366]' : 'text-slate-400 hover:text-slate-600'}`}>
            Expertise & Audit {activeTab === 'audit' && <div className="absolute bottom-0 left-0 w-full h-1 bg-[#003366] rounded-full"></div>}
          </button>
          <button onClick={() => setActiveTab('original')} className={`px-10 py-5 text-xs font-bold uppercase tracking-widest relative transition-colors ${activeTab === 'original' ? 'text-[#003366]' : 'text-slate-400 hover:text-slate-600'}`}>
            Texte d'Origine {activeTab === 'original' && <div className="absolute bottom-0 left-0 w-full h-1 bg-[#003366] rounded-full"></div>}
          </button>
        </nav>

        {activeTab === 'audit' ? (
          <div className="space-y-32">
            {(['forces', 'faiblesses', 'propositions'] as SectionTopic[]).map((topic, index) => {
              const response = currentResponses[topic];
              return (
                <section key={topic} className="relative">
                  <div className="flex justify-between items-center mb-10 border-b border-slate-100 pb-6">
                    <div className="flex items-center gap-5">
                      <span className="bg-[#003366] text-white w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shadow-lg">0{index + 1}</span>
                      <h2 className="font-serif text-3xl text-[#003366]">{currentDoc.sections[topic].title}</h2>
                    </div>
                    <div className="flex gap-3">
                        {selectedDoc === 'sphinx' && topic === 'propositions' && (
                          <button onClick={() => handleAIRequest(topic, "Élabore spécifiquement sur les opportunités de la CSU au Cameroun.")} className="no-print text-[9px] bg-amber-600 text-white px-6 py-3 rounded-full hover:bg-black transition-all font-bold uppercase tracking-widest shadow-md">💡 Stratégie CSU</button>
                        )}
                        <button onClick={() => handleAIRequest(topic)} className="no-print text-[9px] bg-[#003366] text-white px-6 py-3 rounded-full hover:bg-black transition-all font-bold uppercase tracking-widest shadow-md flex items-center gap-2">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"/></svg>
                          Avis IA Vocal
                        </button>
                    </div>
                  </div>

                  <div className={`grid gap-12 relative ${response || loading[topic] ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                    <div className="prose prose-slate max-w-none text-slate-700 text-sm leading-relaxed p-8 bg-slate-50 rounded-3xl border border-slate-200 shadow-inner">
                      <h3 className="font-bold text-[#003366] uppercase text-[10px] tracking-[0.2em] mb-6 opacity-40 italic flex items-center gap-2">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/></svg>
                        Texte de référence d'origine
                      </h3>
                      <div className="font-inter">
                        {currentDoc.sections[topic].content}
                      </div>
                    </div>
                    
                    {(response || loading[topic]) && (
                      <div className="h-[550px] overflow-hidden">
                        <AIResponseBox 
                          docId={selectedDoc}
                          topic={topic} 
                          baseText={currentDoc.sections[topic].rawText} 
                          responseHtml={response} 
                          isLoading={loading[topic]} 
                          audioBuffer={audioBuffers[topic] || null}
                          onRegenerate={() => handleAIRequest(topic)}
                          onClose={() => closeAI(topic)}
                        />
                      </div>
                    )}
                  </div>
                  <NoteArea docId={selectedDoc} secId={topic} value={notes[`${selectedDoc}-${topic}`] || ''} onChange={(val) => setNotes(p => ({...p, [`${selectedDoc}-${topic}`]: val}))} />
                </section>
              );
            })}
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-5 duration-700">
            {currentDoc.originalRef}
          </div>
        )}

        <footer className="mt-32 pt-12 border-t border-slate-100 flex justify-between items-center opacity-30 text-[10px] font-black uppercase tracking-[0.4em] no-print">
          <div>Cabinet SPHINX Consulting x Dr JONGWANE</div>
          <div>DOUALA • Yaoundé • 2026</div>
        </footer>
      </div>
    </div>
  );
};

export default App;
