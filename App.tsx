
import React, { useState, useEffect, useRef } from 'react';
import { SectionTopic, DocumentId, DocumentData } from './types';
import { askGeminiExpert, generateSpeech } from './services/geminiService';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

// Configuration du worker PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs`;

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
  referenceContent: React.ReactNode;
  onRegenerate: () => void;
  onClose: () => void;
  responseHtml: string;
  isLoading: boolean;
  audioBuffer: AudioBuffer | null;
}

const AIResponseBox: React.FC<AIProps> = ({ docId, topic, baseText, referenceContent, onRegenerate, onClose, responseHtml, isLoading, audioBuffer }) => {
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<string>(responseHtml || '');
  const [isAsking, setIsAsking] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (responseHtml) setChatHistory(responseHtml);
  }, [responseHtml]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isAsking]);

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
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
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
    if (!question.trim() || isAsking) return;
    
    const userQ = question;
    setQuestion('');
    setIsAsking(true);
    
    // Voiceflow Style: Clear bubble for user
    setChatHistory(prev => prev + `<div class="mt-8 p-6 bg-slate-100 border-r-8 border-slate-300 rounded-l-3xl text-sm md:text-lg font-semibold text-slate-800 shadow-sm animate-in slide-in-from-right-2">VOUS : ${userQ}</div>`);

    try {
      const result = await askGeminiExpert(docId, topic, baseText, userQ);
      setChatHistory(prev => prev + `<div class="mt-10 border-t-2 border-slate-50 pt-10 animate-in fade-in duration-700">${result.text}</div>`);
      
      const newAudio = await generateSpeech(result.text.replace(/<[^>]*>/g, ''));
      if (newAudio) {
        stopAudio();
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        audioContextRef.current = ctx;
        const source = ctx.createBufferSource();
        source.buffer = newAudio;
        source.connect(ctx.destination);
        source.start(0);
        audioSourceRef.current = source;
      }
    } catch (err) {
      setChatHistory(prev => prev + `<div class="mt-4 text-red-500 text-xs">Erreur de diagnostic...</div>`);
    } finally {
      setIsAsking(false);
    }
  };

  if (!responseHtml && !isLoading) return null;

  return (
    <div className="fixed inset-0 md:inset-6 lg:inset-10 z-[250] bg-white md:rounded-[4rem] shadow-[0_0_200px_rgba(0,0,0,0.7)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-20 duration-500 no-print border-4 border-white">
      {/* Header Statutaire */}
      <div className="bg-[#002147] px-8 md:px-14 py-6 md:py-8 flex items-center justify-between shadow-2xl shrink-0 z-50 border-b-4 border-orange-600">
        <div className="flex items-center gap-6 md:gap-10">
          <div className="bg-orange-600 p-3 md:p-5 rounded-[2rem] shadow-[0_0_30px_rgba(234,88,12,0.5)]">
            <svg className="w-8 h-8 md:w-12 md:h-12 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"/></svg>
          </div>
          <div>
            <h2 className="text-white text-xl md:text-3xl font-serif font-black italic tracking-tighter leading-none uppercase">Analyse Comparative</h2>
            <p className="text-orange-400 text-[10px] md:text-sm font-black uppercase tracking-[0.5em] mt-2">Diagnostic Expert IA • Dr JONGWANE</p>
          </div>
        </div>
        <div className="flex items-center gap-6 md:gap-10">
          <button onClick={playAudio} className="w-12 h-12 md:w-16 md:h-16 rounded-3xl bg-white/10 text-white flex items-center justify-center hover:bg-orange-600 hover:scale-110 transition-all shadow-lg group">
            <svg className="w-8 h-8 md:w-10 md:h-10 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"/></svg>
          </button>
          <button onClick={handleClose} className="w-12 h-12 md:w-16 md:h-16 rounded-3xl bg-orange-600 text-white flex items-center justify-center hover:bg-red-700 transition-all hover:scale-110 font-black text-2xl md:text-3xl shadow-xl">✕</button>
        </div>
      </div>

      {/* Main Split Screen Area */}
      <div className="flex-1 flex flex-col xl:flex-row overflow-hidden relative p-4 md:p-8 lg:p-12 gap-6 md:gap-10 lg:gap-14 bg-slate-50/20">
        {isLoading && <LoadingOverlay />}
        
        {/* Block A: Source de Référence (35%) */}
        <div className="xl:w-[35%] h-full bg-slate-100/60 rounded-[3rem] border-2 border-slate-200 shadow-inner flex flex-col overflow-hidden animate-in slide-in-from-left-10 duration-700">
          <div className="px-10 py-8 bg-slate-200/50 border-b border-slate-200 flex items-center gap-4 shrink-0">
            <div className="w-4 h-4 rounded-full bg-[#002147] shadow-sm"></div>
            <span className="text-xs md:text-base font-black uppercase tracking-[0.4em] text-[#002147]">Source de Référence</span>
          </div>
          <div className="flex-1 overflow-y-auto p-10 md:p-12 custom-scrollbar">
            <div className="prose prose-slate max-w-none text-slate-700 text-sm md:text-xl lg:text-2xl leading-relaxed font-inter italic opacity-70">
              {referenceContent}
            </div>
          </div>
        </div>

        {/* Block B: Diagnostic IA (65%) */}
        <div className="xl:w-[65%] h-full bg-white rounded-[3rem] border-4 border-white shadow-[0_40px_80px_-20px_rgba(0,0,0,0.2)] flex flex-col overflow-hidden animate-in slide-in-from-right-10 duration-700 relative">
          <div className="px-10 py-8 bg-orange-600/5 border-b-2 border-orange-100 flex items-center gap-4 shrink-0">
            <div className="w-4 h-4 rounded-full bg-orange-600 animate-pulse"></div>
            <span className="text-xs md:text-base font-black uppercase tracking-[0.4em] text-orange-600">Expertise & Recommandations Stratégiques</span>
          </div>

          <div className="flex-1 overflow-y-auto p-10 md:p-14 lg:p-20 custom-scrollbar">
            {!isLoading && (
              <>
                <div className="ai-content text-[16px] md:text-[22px] lg:text-[26px] text-[#002147] leading-relaxed font-inter" dangerouslySetInnerHTML={{ __html: (chatHistory || "").replace(/\n\n/g, '</div><div class="mt-12">') }} />
                {isAsking && (
                  <div className="mt-16 flex items-center gap-6 bg-orange-50 p-8 rounded-[2.5rem] border border-orange-100 shadow-sm animate-pulse">
                    <div className="flex gap-2">
                      <span className="w-4 h-4 bg-orange-600 rounded-full animate-bounce"></span>
                      <span className="w-4 h-4 bg-orange-600 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-4 h-4 bg-orange-600 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    </div>
                    <span className="text-sm md:text-xl font-black uppercase tracking-[0.2em] text-orange-700 italic">Analyse en cours...</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </>
            )}
          </div>

          {/* Interactive Chat (Voiceflow Style) */}
          <div className="px-10 md:px-16 lg:px-20 py-10 border-t-2 border-slate-50 bg-slate-50/50 backdrop-blur-md shrink-0">
            <form onSubmit={handleAsk} className="flex gap-6 no-print relative group">
              <input 
                type="text" 
                value={question} 
                onChange={(e) => setQuestion(e.target.value)} 
                placeholder="Posez une question à l'expert..." 
                disabled={isAsking}
                className="flex-1 bg-white border-4 border-slate-100 rounded-[2.5rem] px-10 py-7 text-lg md:text-2xl lg:text-3xl focus:ring-8 focus:ring-orange-600/10 focus:border-orange-600 outline-none font-inter transition-all shadow-xl placeholder:text-slate-200" 
              />
              <button 
                type="submit" 
                disabled={isAsking || !question.trim()} 
                className="bg-orange-600 text-white w-20 h-20 md:w-28 md:h-28 rounded-[2.5rem] flex items-center justify-center hover:bg-orange-700 transition-all shadow-2xl disabled:opacity-50 active:scale-90 shrink-0 border-4 border-white"
              >
                {isAsking ? (
                   <svg className="animate-spin h-10 w-10 text-white" fill="none" viewBox="0 0 24 24">
                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                   </svg>
                ) : (
                  <svg className="w-12 h-12 md:w-16 md:h-16 rotate-90" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
                  </svg>
                )}
              </button>
            </form>
          </div>
        </div>
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
      <div className="prose prose-slate max-w-none space-y-8 font-inter text-slate-700 leading-relaxed text-[16px] p-8 md:p-16 bg-white rounded-[2.5rem] md:rounded-[4rem] shadow-inner border border-slate-100">
        <header className="text-center border-b border-slate-100 pb-12 mb-12">
            <h1 className="text-4xl md:text-5xl font-serif text-[#002147] uppercase mb-4 tracking-tight font-black italic">SPHINX CONSULTING</h1>
            <p className="text-amber-600 font-black uppercase tracking-[0.5em] text-[12px] md:text-[14px]">Cabinet de conseil stratégique, santé publique et développement</p>
        </header>
        <section>
            <h2 className="text-2xl font-bold text-[#002147] mb-6 border-l-8 border-amber-500 pl-8">1. PRÉSENTATION GÉNÉRALE</h2>
            <p>SPHINX Consulting est un cabinet de conseil pluridisciplinaire spécialisé dans l’accompagnement stratégique des institutions publiques, organisations internationales, ONG, associations et structures privées à impact social. Le cabinet intervient principalement dans les domaines de la santé publique, du développement humain, de l’économie appliquée et de la gouvernance des projets et politiques publiques.</p>
            <p className="mt-8">Dans un contexte marqué par des ressources limitées, des besoins sociaux croissants et des exigences accrues des partenaires techniques et financiers, SPHINX Consulting se positionne comme un acteur de référence offrant des solutions adaptées, rigoureuses et orientées vers l’impact.</p>
        </section>
        <section>
            <h2 className="text-2xl font-bold text-[#002147] mb-6 border-l-8 border-amber-500 pl-8">2. VISION, MISSION ET VALEURS</h2>
            <p><strong>Vision:</strong> Contribuer durablement à l’amélioration des systèmes sociaux et sanitaires par un conseil stratégique fondé sur l’expertise, l’innovation et l’équité.</p>
            <p className="mt-8"><strong>Mission:</strong> Appuyer les décideurs et les organisations dans la conception, la mise en œuvre et l’évaluation de politiques, programmes et projets à fort impact social, en tenant compte des réalités locales et des standards internationaux.</p>
            <p className="mt-8"><strong>Valeurs:</strong> Excellence technique et scientifique, Éthique et intégrité professionnelle, Approche contextuelle et participative, Orientation résultats et impact, Équité et inclusion.</p>
        </section>
        <section>
            <h2 className="text-2xl font-bold text-[#002147] mb-6 border-l-8 border-amber-500 pl-8">3. DOMAINES D’INTERVENTION</h2>
            <ul className="list-disc pl-8 space-y-4">
              <li>Conseil en santé publique et systèmes de santé (Appui CSU).</li>
              <li>Économie de la santé et études socio-économiques.</li>
              <li>Montage, gestion et évaluation de projets.</li>
              <li>Recherche appliquée et études stratégiques.</li>
              <li>Appui institutionnel et gouvernance (Audit organisationnel).</li>
            </ul>
        </section>
        <section>
            <h2 className="text-2xl font-bold text-[#002147] mb-6 border-l-8 border-amber-500 pl-8">6. GRILLE TARIFAIRE INDICATIVE</h2>
            <div className="overflow-x-auto my-10 shadow-xl rounded-3xl border border-slate-100">
              <table className="min-w-full border-collapse text-[14px] md:text-[16px]">
                  <thead className="bg-[#002147] text-white"><tr><th className="p-6 border border-slate-200 text-left">Prestation</th><th className="p-6 border border-slate-200">Tarif (FCFA)</th></tr></thead>
                  <tbody>
                      <tr><td className="p-6 border border-slate-100">Diagnostic sectoriel / étude stratégique</td><td className="p-6 border border-slate-100 font-bold">1 800 000 – 6 000 000</td></tr>
                      <tr><td className="p-6 border border-slate-100">Étude économique (coût-efficacité, impact)</td><td className="p-6 border border-slate-100 font-bold">3 000 000 – 9 000 000</td></tr>
                      <tr><td className="p-6 border border-slate-100">Élaboration de projet / note conceptuelle</td><td className="p-6 border border-slate-100 font-bold">900 000 – 2 400 000</td></tr>
                      <tr><td className="p-6 border border-slate-100">Audit organisationnel et institutionnel</td><td className="p-6 border border-slate-100 font-bold">1 800 000 – 4 800 000</td></tr>
                  </tbody>
              </table>
            </div>
        </section>
        <section>
            <h2 className="text-2xl font-bold text-[#002147] mb-6 border-l-8 border-amber-500 pl-8">9. CODE D’ÉTHIQUE ET DE CONDUITE</h2>
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
      <div className="prose prose-slate max-w-none space-y-8 font-inter text-slate-700 leading-relaxed text-[16px] p-8 md:p-16 bg-white rounded-[2.5rem] md:rounded-[4rem] shadow-inner border border-slate-100">
        <header className="text-center border-b border-slate-100 pb-12 mb-12">
            <p className="text-amber-600 font-black uppercase tracking-[0.4em] text-[10px] md:text-[12px] mb-4">PROJET DE SANTÉ HOSPITALIER 2026</p>
            <h1 className="text-3xl md:text-5xl font-serif text-[#002147] uppercase tracking-tight italic font-black">Écho-Pédiatrie : Sauver des Vies</h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] md:text-[12px] mt-4">Hôpital Catholique Padre Pio • Douala • Association Aide Médicale</p>
        </header>
        <section>
            <h2 className="text-2xl font-bold text-[#002147] mb-6 border-l-8 border-amber-500 pl-8">1. PRÉSENTATION DE L’ÉTABLISSEMENT</h2>
            <p>L’Hôpital Catholique Padre Pio est une structure sanitaire à forte vocation sociale et humanitaire, accueillant en moyenne 1 000 enfants par mois. Les urgences pédiatriques constituent un service stratégique de l’hôpital.</p>
        </section>
        <section>
            <h2 className="text-2xl font-bold text-[#002147] mb-6 border-l-8 border-amber-500 pl-8">2. CONTEXTE ET JUSTIFICATION</h2>
            <p>Urgences marquées par une charge élevée de pathologies infectieuses et respiratoires. Accès limité à l’imagerie lourde. L’échographie clinique au lit du patient (POCUS) est non invasive, sans irradiation, rapide et peu coûteuse.</p>
        </section>
        <section>
            <h2 className="text-2xl font-bold text-[#002147] mb-6 border-l-8 border-amber-500 pl-8">3. PROBLÉMATIQUE</h2>
            <ul className="list-disc pl-8 space-y-4">
              <li>Retards diagnostiques dans les urgences vitales.</li>
              <li>Difficultés de triage rapide des nouveau-nés graves.</li>
              <li>Dépendance à des examens coûteux ou indisponibles.</li>
              <li>Insuffisance de personnel formé à l’échographie pédiatrique.</li>
            </ul>
        </section>
        <section>
            <h2 className="text-2xl font-bold text-[#002147] mb-6 border-l-8 border-amber-500 pl-8">4. OBJECTIFS DU PROJET</h2>
            <p><strong>Objectif général :</strong> Améliorer durablement la prise en charge des urgences pédiatriques via POCUS.</p>
            <p className="mt-8"><strong>Objectifs spécifiques :</strong> Réduire le délai diagnostique, renforcer les compétences cliniques, optimiser le triage, réduire la mortalité infantile évitable.</p>
        </section>
        <section>
            <h2 className="text-2xl font-bold text-[#002147] mb-6 border-l-8 border-amber-500 pl-8">7. BUDGET PRÉVISIONNEL</h2>
            <div className="overflow-x-auto my-10 shadow-xl rounded-3xl border border-slate-100">
              <table className="min-w-full text-left border-collapse border border-slate-200 text-[14px] md:text-[16px]">
                  <thead className="bg-[#002147] text-white">
                    <tr><th className="p-6 border">Poste</th><th className="p-6 border">Description</th><th className="p-6 border">Montant (FCFA)</th></tr>
                  </thead>
                  <tbody>
                    <tr><td className="p-6 border">Équipements</td><td className="p-6 border">02 Échographes portables + Sondes</td><td className="p-6 border font-bold">9 000 000</td></tr>
                    <tr><td className="p-6 border">Formation</td><td className="p-6 border">Experts formateurs (5 jours)</td><td className="p-6 border font-bold">1 500 000</td></tr>
                    <tr><td className="p-6 border">Aménagement</td><td className="p-6 border">Sécurisation et stockage</td><td className="p-6 border font-bold">500 000</td></tr>
                    <tr><td className="p-6 border">Suivi-Éval</td><td className="p-6 border">Collecte de données (1 an)</td><td className="p-6 border font-bold">1 000 000</td></tr>
                    <tr className="bg-slate-50 font-black"><td colSpan={2} className="p-6 border text-right uppercase tracking-widest">TOTAL GÉNÉRAL</td><td className="p-6 border text-orange-600">12 000 000 FCFA</td></tr>
                  </tbody>
              </table>
            </div>
        </section>
        <section>
            <h2 className="text-2xl font-bold text-[#002147] mb-6 border-l-8 border-amber-500 pl-8">9. PÉRENNISATION</h2>
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
  const [isExtracting, setIsExtracting] = useState(false);
  const [newDocData, setNewDocData] = useState({ title: '', subtitle: '', text: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistence (v14 pour le nouveau split screen)
  useEffect(() => {
    const saved = localStorage.getItem('dr_jongwane_studio_v14');
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
    localStorage.setItem('dr_jongwane_studio_v14', JSON.stringify({ aiResponses, notes, customDocs }));
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
      alert("Analyse interrompue. Vérifiez votre clé API ou connexion."); 
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    try {
      let extractedText = "";
      if (file.type === "application/pdf") {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          fullText += textContent.items.map((item: any) => item.str).join(" ") + "\n";
        }
        extractedText = fullText;
      } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        extractedText = result.value;
      }

      if (extractedText) {
        // Voiceflow Style: Clear extraction, spaced paragraphs, no special markdown characters
        const formatted = extractedText
          .replace(/\*/g, '')
          .replace(/#/g, '')
          .replace(/(\n{2,})/g, '\n\n')
          .trim();

        setNewDocData(prev => ({
          ...prev,
          text: formatted,
          title: prev.title || file.name.split('.')[0]
        }));
      }
    } catch (error) {
      alert("Erreur lors de l'extraction. Fichier corrompu ?");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAddDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocData.title || !newDocData.text) return;
    const newId = `custom-${Date.now()}` as any;
    const created: DocumentData = {
      id: newId,
      title: newDocData.title,
      subtitle: newDocData.subtitle || 'Dossier d\'Audit Stratégique Indépendant',
      sections: {
        forces: { title: 'Points Forts', content: <p className="italic text-slate-400">Diagnostic IA requis...</p>, rawText: newDocData.text },
        faiblesses: { title: 'Risques & Lacunes', content: <p className="italic text-slate-400">Diagnostic IA requis...</p>, rawText: newDocData.text },
        propositions: { title: 'Optimisation Stratégique', content: <p className="italic text-slate-400">Diagnostic IA requis...</p>, rawText: newDocData.text }
      },
      originalRef: (
        <div className="p-12 md:p-20 bg-white border border-slate-100 rounded-[3rem] md:rounded-[5rem] shadow-inner font-inter text-base md:text-2xl leading-relaxed text-slate-700 whitespace-pre-wrap">
            <h2 className="text-3xl md:text-5xl font-serif text-[#002147] mb-12 uppercase italic border-b-2 pb-8 tracking-tighter font-black">{newDocData.title}</h2>
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
      <div className="min-h-screen flex flex-col items-center justify-center p-6 md:p-14 bg-[radial-gradient(circle_at_top,#ffffff,#fdfdfd)] overflow-y-auto">
        <div className="text-center mb-16 md:mb-24 animate-in fade-in zoom-in-95 duration-1000">
          <h1 className="text-5xl md:text-8xl font-serif text-[#002147] mb-4 uppercase tracking-tighter italic font-black">STUDIO Dr JONGWANE</h1>
          <h2 className="text-[12px] md:text-lg font-black text-orange-600 uppercase tracking-[0.7em] px-4 leading-relaxed">Intelligence Artificielle & Expertise Stratégique</h2>
          <div className="w-24 md:w-32 h-2 bg-orange-500 mx-auto rounded-full mt-8 shadow-2xl"></div>
        </div>
        
        <div className="max-w-7xl w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 px-2 md:px-6">
          {Object.values(documents).map((doc) => (
            <div key={doc.id} className="group glass p-10 md:p-14 rounded-[3.5rem] shadow-2xl flex flex-col items-center text-center transition-all hover:translate-y-[-10px] hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.2)] cursor-default border border-slate-200/50">
              <div className="w-20 h-20 md:w-28 md:h-28 bg-white rounded-[2rem] flex items-center justify-center mb-8 text-5xl shadow-inner group-hover:scale-110 group-hover:bg-orange-50 transition-all duration-500">
                {doc.id.toString().includes('custom') ? '📜' : (doc.id === 'sphinx' ? '🏛️' : '🏥')}
              </div>
              <h2 className="font-serif text-2xl md:text-3xl text-[#002147] mb-4 h-24 overflow-hidden leading-tight font-black tracking-tight">{doc.title}</h2>
              <p className="text-[11px] md:text-sm font-black uppercase tracking-[0.3em] text-orange-600 mb-8 md:mb-12 opacity-60 truncate w-full px-8">{doc.subtitle}</p>
              <button onClick={() => setSelectedDoc(doc.id)} className="w-full bg-orange-600 text-white py-6 rounded-3xl font-black uppercase tracking-widest text-sm hover:bg-orange-700 transition-all shadow-2xl active:scale-95 group-hover:shadow-orange-200/50">Lancer l'Expertise IA</button>
            </div>
          ))}
          
          <button onClick={() => setShowAddForm(true)} className="group glass border-4 border-dashed border-slate-200 p-14 rounded-[3.5rem] flex flex-col items-center justify-center text-center transition-all hover:border-orange-400 hover:bg-white hover:shadow-2xl hover:scale-[1.02]">
            <div className="text-7xl md:text-9xl mb-8 text-slate-100 group-hover:text-orange-500 transition-all duration-500 group-hover:scale-125">＋</div>
            <span className="font-black text-slate-400 group-hover:text-[#002147] text-sm md:text-base uppercase tracking-[0.2em]">Nouveau Dossier d'Audit</span>
          </button>
        </div>

        {showAddForm && (
          <div className="fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-center p-8 backdrop-blur-2xl animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-7xl rounded-[4rem] p-12 md:p-20 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] relative flex flex-col max-h-[90vh] border border-slate-100">
              <button onClick={() => setShowAddForm(false)} className="absolute top-12 right-16 text-slate-300 hover:text-orange-600 text-6xl transition-all hover:scale-110 z-10">✕</button>
              <h2 className="text-3xl md:text-5xl font-serif text-[#002147] mb-14 font-black italic border-b pb-10">Initialisation d'Audit Stratégique</h2>
              <form onSubmit={handleAddDocument} className="grid grid-cols-1 lg:grid-cols-2 gap-20 overflow-y-auto pr-8 custom-scrollbar">
                <div className="space-y-12">
                  <div className="group">
                    <label className="block text-sm font-black uppercase tracking-[0.3em] text-slate-500 mb-5 group-focus-within:text-orange-600 transition-colors">Nom du Client / Projet</label>
                    <input required placeholder="Ex: Plan Stratégique SPHINX 2026" className="w-full p-8 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:border-orange-500 outline-none text-2xl font-inter transition-all shadow-inner" value={newDocData.title} onChange={e => setNewDocData({...newDocData, title: e.target.value})} />
                  </div>
                  
                  <div className="p-10 md:p-14 border-4 border-dashed border-slate-100 rounded-[3rem] bg-slate-50/50 flex flex-col items-center justify-center text-center group hover:border-orange-400 transition-all">
                     <p className="text-[12px] font-black uppercase tracking-widest text-slate-400 mb-6">Extraction Automatisée</p>
                     <button 
                       type="button" 
                       onClick={() => fileInputRef.current?.click()}
                       disabled={isExtracting}
                       className="bg-[#002147] text-white px-10 py-5 rounded-3xl font-black uppercase tracking-[0.3em] hover:bg-orange-600 transition-all flex items-center gap-4 text-sm"
                     >
                        {isExtracting ? "Extraction..." : "Importer PDF / DOCX"}
                     </button>
                     <input 
                       ref={fileInputRef}
                       type="file" 
                       accept=".pdf,.docx" 
                       onChange={handleFileUpload} 
                       className="hidden" 
                     />
                     <p className="mt-6 text-[10px] text-slate-300 font-medium tracking-[0.2em] uppercase">L'IA formatera le texte au format aéré</p>
                  </div>

                  <button type="submit" className="w-full bg-[#002147] text-white py-10 rounded-[2rem] font-black uppercase tracking-[0.3em] text-2xl hover:bg-black transition-all shadow-2xl font-inter flex items-center justify-center gap-6 group hover:scale-[1.02] active:scale-95">
                    Lancer le Diagnostic Expert
                  </button>
                </div>
                <div className="flex flex-col">
                  <label className="block text-sm font-black uppercase tracking-[0.3em] text-slate-500 mb-5">Contenu Source à Analyser</label>
                  <textarea required placeholder="Collez ici le contenu source pour un diagnostic IA complet..." rows={14} className="w-full p-10 bg-slate-50 border-2 border-slate-100 rounded-[3rem] focus:border-orange-500 outline-none font-inter text-xl leading-relaxed resize-none shadow-inner transition-all flex-1 min-h-[450px] custom-scrollbar" value={newDocData.text} onChange={e => setNewDocData({...newDocData, text: e.target.value})}></textarea>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  const currentDoc = documents[selectedDoc];
  const currentResponses = aiResponses[selectedDoc] || {};

  return (
    <div className="min-h-screen py-10 md:py-24 px-4 flex flex-col items-center font-inter bg-[radial-gradient(circle_at_top,#ffffff,#fdfdfd)]">
      <button onClick={() => setSelectedDoc(null)} className="no-print fixed bottom-16 left-16 z-[150] bg-[#002147] text-white px-12 py-7 rounded-full shadow-[0_25px_50px_-12px_rgba(0,33,71,0.5)] font-black uppercase tracking-widest text-sm hover:bg-black active:scale-95 transition-all flex items-center gap-4 font-inter border border-white/20 hover:scale-105">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
        Studio Principal
      </button>
      
      <div className="w-full max-w-full md:max-w-[210mm] bg-white p-8 md:p-24 shadow-[0_50px_120px_-30px_rgba(0,0,0,0.18)] relative border-t-[25px] border-[#002147] rounded-t-[6rem] overflow-hidden">
        <header className="text-center mb-24 border-b border-slate-50 pb-20">
          <h1 className="font-serif text-[#002147] text-5xl md:text-8xl uppercase tracking-tighter mb-6 leading-none font-black italic tracking-tight">{currentDoc.title}</h1>
          <div className="inline-block px-10 py-4 bg-slate-50 border border-slate-100 rounded-full text-orange-600 font-black text-sm uppercase tracking-[0.7em] shadow-sm font-inter">{currentDoc.subtitle}</div>
        </header>

        <nav className="no-print flex justify-center mb-24 gap-8">
          <button onClick={() => setActiveTab('audit')} className={`px-16 py-8 rounded-3xl text-sm font-black uppercase tracking-widest transition-all font-inter shadow-xl hover:scale-105 active:scale-95 ${activeTab === 'audit' ? 'bg-[#002147] text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
            Audit Strategy
          </button>
          <button onClick={() => setActiveTab('original')} className={`px-16 py-8 rounded-3xl text-sm font-black uppercase tracking-widest transition-all font-inter shadow-xl hover:scale-105 active:scale-95 ${activeTab === 'original' ? 'bg-[#002147] text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
            Contenu d'Origine
          </button>
        </nav>

        {activeTab === 'audit' ? (
          <div className="space-y-48 md:space-y-64">
            {(['forces', 'faiblesses', 'propositions'] as SectionTopic[]).map((topic, index) => {
              const response = currentResponses[topic];
              return (
                <section key={topic} className="relative group">
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-16 gap-12 border-b-2 border-slate-100 pb-12">
                    <div className="flex items-center gap-8">
                      <span className="bg-orange-100 text-orange-700 w-20 h-20 rounded-3xl flex items-center justify-center font-serif text-4xl font-black italic shadow-inner">0{index + 1}</span>
                      <h2 className="font-serif text-4xl md:text-5xl text-[#002147] font-black italic tracking-tight">{currentDoc.sections[topic].title}</h2>
                    </div>
                    <button onClick={() => handleAIRequest(topic)} className="no-print w-full lg:w-auto bg-orange-600 text-white px-14 py-6 rounded-[1.5rem] hover:bg-orange-700 transition-all font-black uppercase tracking-widest shadow-2xl flex items-center justify-center gap-6 font-inter border border-white/20 active:scale-95 hover:scale-105">
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"/></svg>
                      Expertise IA
                    </button>
                  </div>

                  <div className="prose prose-slate max-w-none text-slate-600 text-xl lg:text-2xl leading-relaxed p-14 bg-slate-50/50 rounded-[3.5rem] border-2 border-slate-100 shadow-inner font-inter whitespace-pre-wrap">
                    {currentDoc.sections[topic].content}
                  </div>

                  {(response || loading[topic]) && (
                    <AIResponseBox 
                      docId={selectedDoc}
                      topic={topic} 
                      baseText={currentDoc.sections[topic].rawText} 
                      referenceContent={currentDoc.sections[topic].content}
                      responseHtml={response} 
                      isLoading={loading[topic]} 
                      audioBuffer={audioBuffers[topic] || null}
                      onRegenerate={() => handleAIRequest(topic)}
                      onClose={() => closeAI(topic)}
                    />
                  )}
                  <NoteArea docId={selectedDoc} secId={topic} value={notes[`${selectedDoc}-${topic}`] || ''} onChange={(val) => setNotes(p => ({...p, [`${selectedDoc}-${topic}`]: val}))} />
                </section>
              );
            })}
          </div>
        ) : (
          <div className="animate-in fade-in duration-1000">
            {currentDoc.originalRef}
          </div>
        )}

        <footer className="mt-56 pt-24 border-t-2 border-slate-100 flex flex-col md:flex-row justify-between items-center opacity-40 text-sm font-black uppercase tracking-[0.7em] no-print font-inter gap-8 text-center">
          <div>CABINET Dr JONGWANE • AUDIT & STRATÉGIE</div>
          <div className="flex items-center gap-4">
            <span className="w-3 h-3 rounded-full bg-orange-500 shadow-lg shadow-orange-500/50 animate-pulse"></span>
            <span>DOUALA • CAMEROUN • 2026</span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
