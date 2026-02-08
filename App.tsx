
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
    <div className="mt-8 md:mt-10 no-print group">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2.5 h-2.5 rounded-full bg-[#002147]"></span>
        <label className="text-xs md:text-sm font-black uppercase tracking-[0.2em] text-[#002147] opacity-80 group-hover:opacity-100 transition-all">
          Annotations Critiques de l'Auditeur
        </label>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Inscrivez ici vos réflexions stratégiques d'expert..."
        className="w-full min-h-[140px] md:min-h-[160px] p-6 bg-white border-2 border-[#002147] rounded-3xl text-sm md:text-base focus:ring-8 focus:ring-[#002147]/5 transition-all font-inter shadow-lg outline-none resize-none placeholder:text-slate-300 placeholder:text-base md:placeholder:text-lg"
      />
    </div>
  );
};

const LoadingOverlay: React.FC = () => (
  <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center rounded-[2rem] md:rounded-[3rem] animate-in fade-in duration-500 p-6 text-center">
    <div className="scan-line"></div>
    <div className="relative w-20 h-20 md:w-24 md:h-24 mb-6 md:mb-8">
      <div className="absolute inset-0 border-2 border-slate-100 rounded-full"></div>
      <div className="absolute inset-0 border-t-2 border-orange-500 rounded-full animate-spin"></div>
      <div className="absolute inset-4 bg-orange-100/30 rounded-full animate-pulse flex items-center justify-center">
        <svg className="w-8 h-8 md:w-10 md:h-10 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
      </div>
    </div>
    <h3 className="text-[#002147] font-serif text-xl md:text-2xl font-black italic">Expertise Dr JONGWANE</h3>
    <p className="text-slate-400 text-[10px] md:text-xs font-black uppercase tracking-[0.4em] animate-pulse mt-2">Traitement Analytique par IA</p>
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
    <div className="h-full flex flex-col overflow-hidden rounded-[2.5rem] border border-orange-100 bg-white shadow-2xl animate-in fade-in slide-in-from-right-10 duration-500 font-inter no-print relative">
      {isLoading && <LoadingOverlay />}
      <div className="bg-orange-600 px-5 md:px-8 py-4 md:py-6 flex items-center justify-between z-10 shadow-lg">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="bg-white p-1.5 rounded-xl shadow-sm">
            <svg className="w-5 h-5 md:w-6 md:h-6 text-orange-600" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"/></svg>
          </div>
          <span className="text-[10px] md:text-xs font-black uppercase tracking-widest text-white leading-tight">Diagnostic IA Expert Vocal</span>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <button onClick={playAudio} className="p-2 text-white/80 hover:text-white transition-all hover:scale-110" title="Réécouter l'analyse"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"/></svg></button>
          <button onClick={handleClose} className="p-2 text-white/80 hover:text-white transition-all hover:scale-110" title="Fermer"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg></button>
        </div>
      </div>
      <div className="p-6 md:p-10 flex-1 overflow-y-auto min-h-[350px] custom-scrollbar">
        {!isLoading && (
          <>
            <div className="ai-content text-[14px] md:text-[16px] text-slate-700 leading-relaxed font-inter" dangerouslySetInnerHTML={{ __html: (chatHistory || "").replace(/\n\n/g, '</div><div class="mt-6">') }} />
            <form onSubmit={handleAsk} className="mt-12 pt-8 border-t border-slate-100 flex gap-3 md:gap-4 no-print">
              <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Posez une question à l'expert..." className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm md:text-base focus:ring-2 focus:ring-orange-500 transition-all shadow-inner outline-none font-inter" />
              <button type="submit" disabled={isAsking} className="bg-orange-600 text-white px-6 md:px-8 py-4 rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest hover:bg-orange-700 transition-all shadow-xl disabled:opacity-50 active:scale-95">Envoyer</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

// --- Données Initiales (MAINTIEN DU TEXTE INTÉGRAL D'ORIGINE) ---

const INITIAL_DOCUMENTS: Record<string, DocumentData> = {
  sphinx: {
    id: 'sphinx' as DocumentId,
    title: 'Audit Stratégique Sphinx',
    subtitle: 'Cabinet SPHINX Consulting',
    sections: {
      forces: {
        title: 'Validation de l\'Identité',
        content: <p>Cabinet pluridisciplinaire spécialisé dans l'accompagnement stratégique des institutions publiques et structures privées à impact social.</p>,
        rawText: "SPHINX Consulting est un cabinet de conseil pluridisciplinaire spécialisé dans l’accompagnement stratégique des institutions publiques, organisations internationales, ONG, associations et structures privées à impact social. Le cabinet intervient principalement dans les domaines de la santé publique, du développement humain, de l’économie appliquée et de la gouvernance des projets et politiques publiques."
      },
      faiblesses: {
        title: 'Évaluation des Risques',
        content: <p>Analyse des menaces liées à la dépendance aux experts seniors et à la forte concurrence locale.</p>,
        rawText: "Risques identifiés: Dépendance consultants seniors, concurrence locale forte, contexte ressources limitées, exigences élevées des partenaires financiers, risque de dispersion des expertises."
      },
      propositions: {
        title: 'Orientations Tarifaires',
        content: <p>Étude des forfaits entre 1.8M et 9M FCFA selon la complexité des missions stratégiques.</p>,
        rawText: "Tarification indicative: Diagnostic stratégique (1.8M-6M), Étude économique (3M-9M), Audit organisationnel (1.8M-4.8M). Focus sur l'appui à la CSU."
      }
    },
    originalRef: (
      <div className="prose prose-slate max-w-none space-y-8 font-inter text-slate-700 leading-relaxed text-[14px] p-8 md:p-12 bg-white rounded-[2.5rem] md:rounded-[3.5rem] shadow-inner border border-slate-100">
        <header className="text-center border-b border-slate-100 pb-10 mb-10">
            <h1 className="text-3xl md:text-4xl font-serif text-[#002147] uppercase mb-2 tracking-tight font-black italic">SPHINX CONSULTING</h1>
            <p className="text-amber-600 font-black uppercase tracking-[0.4em] text-[10px] md:text-[12px]">Cabinet de conseil stratégique, santé publique et développement</p>
        </header>
        <section>
            <h2 className="text-xl font-bold text-[#002147] mb-4 border-l-4 border-amber-500 pl-5">1. PRÉSENTATION GÉNÉRALE</h2>
            <p>SPHINX Consulting est un cabinet de conseil pluridisciplinaire spécialisé dans l’accompagnement stratégique des institutions publiques, organisations internationales, ONG, associations et structures privées à impact social. Le cabinet intervient principalement dans les domaines de la santé publique, du développement humain, de l’économie appliquée et de la gouvernance des projets et politiques publiques.</p>
            <p className="mt-4">Dans un contexte marqué par des ressources limitées, des besoins sociaux croissants et des exigences accrues des partenaires techniques et financiers, SPHINX Consulting se positionne comme un acteur de référence offrant des solutions adaptées, rigoureuses et orientées vers l’impact.</p>
        </section>
        <section>
            <h2 className="text-xl font-bold text-[#002147] mb-4 border-l-4 border-amber-500 pl-5">2. VISION, MISSION ET VALEURS</h2>
            <p><strong>Vision:</strong> Contribuer durablement à l’amélioration des systèmes sociaux et sanitaires par un conseil stratégique fondé sur l’expertise, l’innovation et l’équité.</p>
            <p className="mt-4"><strong>Mission:</strong> Appuyer les décideurs et les organisations dans la conception, la mise en œuvre et l’évaluation de politiques, programmes et projets à fort impact social, en tenant compte des réalités locales et des standards internationaux.</p>
            <p className="mt-4"><strong>Valeurs:</strong> Excellence technique et scientifique, Éthique et intégrité professionnelle, Approche contextuelle et participative, Orientation résultats et impact, Équité et inclusion.</p>
        </section>
        <section>
            <h2 className="text-xl font-bold text-[#002147] mb-4 border-l-4 border-amber-500 pl-5">3. DOMAINES D’INTERVENTION</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Conseil en santé publique et systèmes de santé (Appui CSU).</li>
              <li>Économie de la santé et études socio-économiques.</li>
              <li>Montage, gestion et évaluation de projets.</li>
              <li>Recherche appliquée et études stratégiques.</li>
              <li>Appui institutionnel et gouvernance (Audit organisationnel).</li>
            </ul>
        </section>
        <section>
            <h2 className="text-xl font-bold text-[#002147] mb-4 border-l-4 border-amber-500 pl-5">6. GRILLE TARIFAIRE INDICATIVE</h2>
            <div className="overflow-x-auto my-6">
              <table className="min-w-full border-collapse text-[12px] md:text-[14px]">
                  <thead className="bg-[#002147] text-white"><tr><th className="p-4 border border-slate-100 text-left">Prestation</th><th className="p-4 border border-slate-100">Tarif (FCFA)</th></tr></thead>
                  <tbody>
                      <tr><td className="p-4 border border-slate-100">Diagnostic sectoriel / étude stratégique</td><td className="p-4 border border-slate-100 font-bold">1 800 000 – 6 000 000</td></tr>
                      <tr><td className="p-4 border border-slate-100">Étude économique (coût-efficacité, impact)</td><td className="p-4 border border-slate-100 font-bold">3 000 000 – 9 000 000</td></tr>
                      <tr><td className="p-4 border border-slate-100">Élaboration de projet / note conceptuelle</td><td className="p-4 border border-slate-100 font-bold">900 000 – 2 400 000</td></tr>
                      <tr><td className="p-4 border border-slate-100">Audit organisationnel et institutionnel</td><td className="p-4 border border-slate-100 font-bold">1 800 000 – 4 800 000</td></tr>
                  </tbody>
              </table>
            </div>
        </section>
        <section>
            <h2 className="text-xl font-bold text-[#002147] mb-4 border-l-4 border-amber-500 pl-5">9. CODE D’ÉTHIQUE ET DE CONDUITE</h2>
            <p>Intégrité (tolérance zéro corruption), Confidentialité (protection stricte des données), Objectivité (indépendance des analyses), Équité (promotion active de l'approche genre).</p>
        </section>
      </div>
    )
  },
  'echo-pediatrie': {
    id: 'echo-pediatrie' as DocumentId,
    title: 'Audit Écho-Pédiatrie',
    subtitle: 'Padre Pio x Aide Médicale',
    sections: {
      forces: {
        title: 'Pertinence du Projet',
        content: <p>Optimisation des urgences pédiatriques via l'échographie clinique (POCUS) à Padre Pio.</p>,
        rawText: "L’Hôpital Catholique Padre Pio accueille en moyenne 1 000 enfants par mois. Objectif: Améliorer durablement la prise en charge des urgences pédiatriques grâce à l’utilisation structurée de l’échographie clinique au lit du patient (POCUS)."
      },
      faiblesses: {
        title: 'Zones Critiques',
        content: <p>Risques liés au manque de personnel formé et aux retards de triage pédiatrique.</p>,
        rawText: "Retards diagnostiques dans les urgences vitales. Difficultés de triage rapide des nouveau-nés graves. Dépendance à des examens coûteux ou indisponibles. Insuffisance de personnel formé à l’échographie pédiatrique."
      },
      propositions: {
        title: 'Optimisation Budgétaire',
        content: <p>Budget de 12M FCFA incluant deux échographes portables et formation experte du staff.</p>,
        rawText: "Budget prévisionnel : 12 000 000 FCFA. Acquisition matériel (9M), Formation experts (1.5M), Aménagement (0.5M), Suivi-Évaluation (1M). Maintenance par quote-part symbolique (tarif social)."
      }
    },
    originalRef: (
      <div className="prose prose-slate max-w-none space-y-8 font-inter text-slate-700 leading-relaxed text-[14px] p-8 md:p-12 bg-white rounded-[2.5rem] md:rounded-[3.5rem] shadow-inner border border-slate-100">
        <header className="text-center border-b border-slate-100 pb-10 mb-10">
            <p className="text-amber-600 font-black uppercase tracking-[0.4em] text-[10px] md:text-[12px] mb-2">PROJET DE SANTÉ HOSPITALIER 2026</p>
            <h1 className="text-3xl md:text-4xl font-serif text-[#002147] uppercase tracking-tight italic font-black">Écho-Pédiatrie : Sauver des Vies</h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-2">Hôpital Catholique Padre Pio • Douala • Association Aide Médicale</p>
        </header>
        <section>
            <h2 className="text-xl font-bold text-[#002147] mb-4 border-l-4 border-amber-500 pl-5">1. PRÉSENTATION DE L’ÉTABLISSEMENT</h2>
            <p>L’Hôpital Catholique Padre Pio est une structure sanitaire à forte vocation sociale et humanitaire, accueillant en moyenne 1 000 enfants par mois. Les urgences pédiatriques constituent un service stratégique de l’hôpital.</p>
        </section>
        <section>
            <h2 className="text-xl font-bold text-[#002147] mb-4 border-l-4 border-amber-500 pl-5">2. CONTEXTE ET JUSTIFICATION</h2>
            <p>Urgences marquées par une charge élevée de pathologies infectieuses et respiratoires. Accès limité à l’imagerie lourde. L’échographie clinique au lit du patient (POCUS) est non invasive, sans irradiation, rapide et peu coûteuse.</p>
        </section>
        <section>
            <h2 className="text-xl font-bold text-[#002147] mb-4 border-l-4 border-amber-500 pl-5">3. PROBLÉMATIQUE</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Retards diagnostiques dans les urgences vitales.</li>
              <li>Difficultés de triage rapide des nouveau-nés graves.</li>
              <li>Dépendance à des examens coûteux ou indisponibles.</li>
              <li>Insuffisance de personnel formé à l’échographie pédiatrique.</li>
            </ul>
        </section>
        <section>
            <h2 className="text-xl font-bold text-[#002147] mb-4 border-l-4 border-amber-500 pl-5">4. OBJECTIFS DU PROJET</h2>
            <p><strong>Objectif général :</strong> Améliorer durablement la prise en charge des urgences pédiatriques via POCUS.</p>
            <p className="mt-4"><strong>Objectifs spécifiques :</strong> Réduire le délai diagnostique, renforcer les compétences cliniques, optimiser le triage, réduire la mortalité infantile évitable.</p>
        </section>
        <section>
            <h2 className="text-xl font-bold text-[#002147] mb-4 border-l-4 border-amber-500 pl-5">7. BUDGET PRÉVISIONNEL</h2>
            <div className="overflow-x-auto my-6">
              <table className="min-w-full text-left border-collapse border border-slate-100 text-[12px] md:text-[14px]">
                  <thead className="bg-[#002147] text-white">
                    <tr><th className="p-4 border">Poste</th><th className="p-4 border">Description</th><th className="p-4 border">Montant (FCFA)</th></tr>
                  </thead>
                  <tbody>
                    <tr><td className="p-4 border">Équipements</td><td className="p-4 border">02 Échographes portables + Sondes</td><td className="p-4 border font-bold">9 000 000</td></tr>
                    <tr><td className="p-4 border">Formation</td><td className="p-4 border">Experts formateurs (5 jours)</td><td className="p-4 border font-bold">1 500 000</td></tr>
                    <tr><td className="p-4 border">Aménagement</td><td className="p-4 border">Sécurisation et stockage</td><td className="p-4 border font-bold">500 000</td></tr>
                    <tr><td className="p-4 border">Suivi-Éval</td><td className="p-4 border">Collecte de données (1 an)</td><td className="p-4 border font-bold">1 000 000</td></tr>
                    <tr className="bg-slate-50 font-black"><td colSpan={2} className="p-4 border text-right">TOTAL GÉNÉRAL</td><td className="p-4 border text-[#002147]">12 000 000 FCFA</td></tr>
                  </tbody>
              </table>
            </div>
        </section>
        <section>
            <h2 className="text-xl font-bold text-[#002147] mb-4 border-l-4 border-amber-500 pl-5">9. PÉRENNISATION</h2>
            <p>Une quote-part symbolique par examen (tarif social) sera perçue pour constituer un fonds de maintenance des appareils. La formation sera intégrée au cursus d'accueil de tout nouveau personnel.</p>
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

  // Persistence
  useEffect(() => {
    const saved = localStorage.getItem('dr_jongwane_studio_v11');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.aiResponses) setAiResponses(parsed.aiResponses);
        if (parsed.notes) setNotes(parsed.notes);
        if (parsed.customDocs) setDocuments(prev => ({ ...prev, ...parsed.customDocs }));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    const customDocs = Object.fromEntries(
      Object.entries(documents).filter(([key]) => key !== 'sphinx' && key !== 'echo-pediatrie')
    );
    localStorage.setItem('dr_jongwane_studio_v11', JSON.stringify({ aiResponses, notes, customDocs }));
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
      const audio = await generateSpeech(result.text.replace(/<[^>]*>/g, ''));
      setAudioBuffers(prev => ({ ...prev, [topic]: audio }));
    } catch (err) { 
      alert("Analyse stratégique interrompue. Vérifiez votre connexion."); 
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
      subtitle: newDocData.subtitle || 'Audit Stratégique Indépendant',
      sections: {
        forces: { title: 'Points Forts', content: <p className="italic text-slate-400">Analyse IA requise...</p>, rawText: newDocData.text },
        faiblesses: { title: 'Risques & Lacunes', content: <p className="italic text-slate-400">Analyse IA requise...</p>, rawText: newDocData.text },
        propositions: { title: 'Optimisation Stratégique', content: <p className="italic text-slate-400">Analyse IA requise...</p>, rawText: newDocData.text }
      },
      originalRef: (
        <div className="p-8 md:p-14 bg-white border border-slate-100 rounded-[2.5rem] md:rounded-[4rem] shadow-inner font-inter text-sm md:text-base leading-relaxed text-slate-700">
            <h2 className="text-2xl md:text-3xl font-serif text-[#002147] mb-8 uppercase italic border-b pb-6 tracking-tight font-black">{newDocData.title}</h2>
            <div className="whitespace-pre-wrap">{newDocData.text}</div>
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
      <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-10 bg-[radial-gradient(circle_at_top,#ffffff,#fdfdfd)] overflow-y-auto">
        <div className="text-center mb-12 md:mb-16 animate-in fade-in zoom-in-95 duration-1000">
          <h1 className="text-4xl md:text-6xl font-serif text-[#002147] mb-2 uppercase tracking-tighter italic font-black">STUDIO Dr JONGWANE</h1>
          <h2 className="text-[11px] md:text-sm font-black text-amber-600 uppercase tracking-[0.6em] px-4 leading-relaxed">Intelligence Artificielle & Expertise Stratégique</h2>
          <div className="w-16 md:w-24 h-1.5 bg-amber-500 mx-auto rounded-full mt-6 shadow-xl"></div>
        </div>
        
        <div className="max-w-7xl w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12 px-2 md:px-6">
          {Object.values(documents).map((doc) => (
            <div key={doc.id} className="group glass p-8 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl flex flex-col items-center text-center transition-all hover:translate-y-[-10px] hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.2)] cursor-default border border-slate-200/50">
              <div className="w-16 h-16 md:w-24 md:h-24 bg-white rounded-3xl md:rounded-[2rem] flex items-center justify-center mb-6 md:mb-8 text-4xl md:text-5xl shadow-inner group-hover:scale-110 group-hover:bg-orange-50 transition-all duration-500">
                {doc.id.toString().includes('custom') ? '📜' : (doc.id === 'sphinx' ? '🏛️' : '🏥')}
              </div>
              <h2 className="font-serif text-2xl md:text-3xl text-[#002147] mb-3 md:mb-4 h-auto md:h-20 overflow-hidden leading-tight font-black tracking-tight">{doc.title}</h2>
              <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-amber-600 mb-8 md:mb-12 opacity-60 truncate w-full px-4 md:px-8">{doc.subtitle}</p>
              <button onClick={() => setSelectedDoc(doc.id)} className="w-full bg-orange-600 text-white py-5 md:py-6 rounded-[1.5rem] font-black uppercase tracking-widest text-[11px] md:text-sm hover:bg-orange-700 hover:scale-[1.05] transition-all shadow-2xl active:scale-95 group-hover:shadow-orange-200/50">Lancer l'Expertise IA</button>
            </div>
          ))}
          
          <button onClick={() => setShowAddForm(true)} className="group glass border-4 border-dashed border-slate-200 p-8 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] flex flex-col items-center justify-center text-center transition-all hover:border-orange-400 hover:bg-white hover:shadow-2xl hover:scale-[1.02]">
            <div className="text-6xl md:text-8xl mb-6 md:mb-8 text-slate-200 group-hover:text-orange-500 transition-all duration-500 group-hover:scale-125">＋</div>
            <span className="font-black text-slate-400 group-hover:text-[#002147] text-sm md:text-base uppercase tracking-[0.2em]">Nouveau Dossier d'Audit</span>
          </button>
        </div>

        {showAddForm && (
          <div className="fixed inset-0 bg-slate-900/70 z-[200] flex items-center justify-center p-4 md:p-8 backdrop-blur-xl overflow-y-auto animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-7xl rounded-[3rem] md:rounded-[4rem] p-8 md:p-20 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] relative flex flex-col max-h-[90vh] border border-slate-100">
              <button onClick={() => setShowAddForm(false)} className="absolute top-8 md:top-14 right-8 md:right-14 text-slate-300 hover:text-orange-600 text-4xl md:text-6xl transition-all hover:scale-110 z-10">✕</button>
              <h2 className="text-2xl md:text-5xl font-serif text-[#002147] mb-8 md:mb-14 font-black italic border-b pb-6 md:pb-10">Initialisation d'Audit Stratégique</h2>
              <form onSubmit={handleAddDocument} className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-20 flex-1 overflow-y-auto pr-4 custom-scrollbar">
                <div className="space-y-8 md:space-y-12">
                  <div className="group">
                    <label className="block text-xs md:text-sm font-black uppercase tracking-[0.3em] text-slate-500 mb-3 md:mb-5 group-focus-within:text-orange-600 transition-colors">Titre du Projet / Client</label>
                    <input required placeholder="Ex: Plan Stratégique SPHINX 2026" className="w-full p-5 md:p-8 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] md:rounded-[2rem] focus:border-orange-500 outline-none text-base md:text-xl font-inter transition-all shadow-inner" value={newDocData.title} onChange={e => setNewDocData({...newDocData, title: e.target.value})} />
                  </div>
                  <div className="group">
                    <label className="block text-xs md:text-sm font-black uppercase tracking-[0.3em] text-slate-500 mb-3 md:mb-5 group-focus-within:text-orange-600 transition-colors">Organisation Responsable</label>
                    <input placeholder="Ex: Audit de performance..." className="w-full p-5 md:p-8 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] md:rounded-[2rem] focus:border-orange-500 outline-none text-base md:text-xl font-inter transition-all shadow-inner" value={newDocData.subtitle} onChange={e => setNewDocData({...newDocData, subtitle: e.target.value})} />
                  </div>
                  <button type="submit" className="w-full bg-[#002147] text-white py-6 md:py-10 rounded-[1.5rem] md:rounded-[2rem] font-black uppercase tracking-[0.2em] text-sm md:text-xl hover:bg-black transition-all shadow-2xl font-inter flex items-center justify-center gap-6 group hover:scale-[1.02] active:scale-95">
                    Lancer le Diagnostic Expert
                    <svg className="w-6 h-6 md:w-8 md:h-8 group-hover:translate-x-4 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>
                  </button>
                </div>
                <div className="flex flex-col">
                  <label className="block text-xs md:text-sm font-black uppercase tracking-[0.3em] text-slate-500 mb-3 md:mb-5 transition-colors">Texte Intégral Source pour Analyse</label>
                  <textarea required placeholder="Collez ici l'intégralité du texte source du projet (Plan stratégique, rapport d'activité, budget...) pour un diagnostic à 360°..." rows={14} className="w-full p-6 md:p-10 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] md:rounded-[2.5rem] focus:border-orange-500 outline-none font-inter text-sm md:text-lg leading-relaxed resize-none shadow-inner transition-all flex-1 min-h-[350px] md:min-h-0" value={newDocData.text} onChange={e => setNewDocData({...newDocData, text: e.target.value})}></textarea>
                </div>
              </form>
            </div>
          </div>
        )}
        
        <div className="mt-16 md:mt-20 text-[10px] md:text-[13px] font-black uppercase tracking-[0.7em] text-slate-300 flex items-center gap-6 md:gap-8">
          <span>Dr JONGWANE STUDIO</span>
          <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-orange-500 shadow-xl shadow-orange-500/50"></span>
          <span>EST. 2026</span>
        </div>
      </div>
    );
  }

  const currentDoc = documents[selectedDoc];
  const currentResponses = aiResponses[selectedDoc] || {};

  return (
    <div className="min-h-screen py-10 md:py-24 px-4 flex flex-col items-center font-inter bg-[radial-gradient(circle_at_top,#ffffff,#fdfdfd)]">
      <button onClick={() => setSelectedDoc(null)} className="no-print fixed bottom-10 md:bottom-16 left-10 md:left-16 z-[150] bg-[#002147] text-white px-8 md:px-12 py-4 md:py-7 rounded-full shadow-[0_25px_50px_-12px_rgba(0,33,71,0.5)] font-black uppercase tracking-widest text-[10px] md:text-sm hover:bg-black active:scale-95 transition-all flex items-center gap-4 font-inter border border-white/20 hover:scale-105">
        <svg className="w-4 h-4 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
        <span className="hidden md:inline">Tableau de Bord Studio</span>
        <span className="md:hidden">Studio</span>
      </button>
      
      <div className="w-full max-w-full md:max-w-[210mm] bg-white p-8 md:p-24 shadow-[0_50px_120px_-30px_rgba(0,0,0,0.18)] relative border-t-[15px] md:border-t-[25px] border-[#002147] rounded-t-[3rem] md:rounded-t-[6rem] overflow-hidden">
        <header className="text-center mb-12 md:mb-24 border-b border-slate-50 pb-12 md:pb-20">
          <h1 className="font-serif text-[#002147] text-4xl md:text-8xl uppercase tracking-tighter mb-4 md:mb-6 leading-none font-black italic tracking-tight">{currentDoc.title}</h1>
          <div className="inline-block px-6 md:px-10 py-2 md:py-4 bg-slate-50 border border-slate-100 rounded-full text-orange-600 font-black text-[9px] md:text-sm uppercase tracking-[0.6em] shadow-sm font-inter">{currentDoc.subtitle}</div>
        </header>

        <nav className="no-print flex flex-wrap justify-center mb-16 md:mb-24 gap-4 md:gap-8">
          <button onClick={() => setActiveTab('audit')} className={`px-8 md:px-16 py-4 md:py-8 rounded-2xl md:rounded-3xl text-[10px] md:text-sm font-black uppercase tracking-widest transition-all font-inter shadow-xl hover:scale-105 active:scale-95 ${activeTab === 'audit' ? 'bg-[#002147] text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
            Audit & Diagnostic IA
          </button>
          <button onClick={() => setActiveTab('original')} className={`px-8 md:px-16 py-4 md:py-8 rounded-2xl md:rounded-3xl text-[10px] md:text-sm font-black uppercase tracking-widest transition-all font-inter shadow-xl hover:scale-105 active:scale-95 ${activeTab === 'original' ? 'bg-[#002147] text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
            Contenu d'Origine
          </button>
        </nav>

        {activeTab === 'audit' ? (
          <div className="space-y-32 md:space-y-56">
            {(['forces', 'faiblesses', 'propositions'] as SectionTopic[]).map((topic, index) => {
              const response = currentResponses[topic];
              return (
                <section key={topic} className="relative group">
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 md:mb-16 gap-8 md:gap-12 border-b border-slate-100 pb-8 md:pb-12">
                    <div className="flex items-center gap-5 md:gap-8">
                      <span className="bg-orange-100 text-orange-700 w-12 h-12 md:w-20 md:h-20 rounded-2xl md:rounded-3xl flex items-center justify-center font-serif text-2xl md:text-4xl font-black italic shadow-inner">0{index + 1}</span>
                      <h2 className="font-serif text-3xl md:text-5xl text-[#002147] font-black italic tracking-tight">{currentDoc.sections[topic].title}</h2>
                    </div>
                    <button onClick={() => handleAIRequest(topic)} className="no-print w-full lg:w-auto text-[10px] md:text-xs bg-orange-600 text-white px-8 md:px-14 py-4 md:py-6 rounded-2xl md:rounded-[1.5rem] hover:bg-orange-700 transition-all font-black uppercase tracking-widest shadow-2xl flex items-center justify-center gap-4 md:gap-6 font-inter border border-white/20 active:scale-95 hover:scale-105">
                      <svg className="w-5 h-5 md:w-7 md:h-7" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"/></svg>
                      Diagnostic Expert IA
                    </button>
                  </div>

                  <div className={`grid gap-12 md:gap-24 relative ${response || loading[topic] ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}`}>
                    <div className="prose prose-slate max-w-none text-slate-600 text-base md:text-xl leading-relaxed p-8 md:p-16 bg-slate-50/50 rounded-[2.5rem] md:rounded-[4rem] border-2 border-slate-100 shadow-inner font-inter">
                      <div className="font-inter">
                        {currentDoc.sections[topic].content}
                      </div>
                    </div>
                    {(response || loading[topic]) && (
                      <div className="h-[500px] md:h-[750px] overflow-hidden">
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
          <div className="animate-in fade-in slide-in-from-bottom-10 duration-1000">
            {currentDoc.originalRef}
          </div>
        )}

        <footer className="mt-32 md:mt-56 pt-16 md:pt-24 border-t-2 border-slate-100 flex flex-col md:flex-row justify-between items-center opacity-50 text-[10px] md:sm font-black uppercase tracking-[0.6em] no-print font-inter gap-8 text-center">
          <div>CABINET Dr JONGWANE • AUDIT & STRATÉGIE CONSEIL</div>
          <div className="flex items-center gap-4">
            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
            <span>DOUALA • CAMEROUN • 2026</span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
