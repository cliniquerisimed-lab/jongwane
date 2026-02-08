
import { GoogleGenAI, Modality } from "@google/genai";
import { SectionTopic, DocumentId } from "../types";

const TOPIC_CONTEXTS: Record<SectionTopic, string> = {
  'forces': "Analyse et valide les points forts du projet. Souligne la pertinence par rapport au contexte camerounais et aux standards internationaux.",
  'faiblesses': "Identifie les risques critiques, les lacunes de planification et les menaces à la pérennité. Propose des solutions de mitigation.",
  'propositions': "Suggère des optimisations stratégiques, budgétaires ou opérationnelles pour maximiser l'impact social et l'efficience."
};

const DOC_CONTEXTS: Record<string, string> = {
  'sphinx': "Le projet concerne un cabinet de conseil stratégique au Cameroun (SPHINX Consulting).",
  'echo-pediatrie': "Le projet concerne l'intégration de l'échographie clinique aux urgences pédiatriques à Douala (Écho-Pédiatrie)."
};

// Fonctions d'encodage/décodage pour l'audio
function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < dataInt16.length; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
}

export const generateSpeech = async (text: string): Promise<AudioBuffer | null> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });
  try {
    // Augmentation de la limite à 5000 caractères pour couvrir tout le texte
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Lis l'intégralité de ce rapport d'audit avec une voix posée, professionnelle et convaincante : ${text.substring(0, 5000)}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Zephyr' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      return await decodeAudioData(decodeBase64(base64Audio), audioCtx);
    }
  } catch (error) {
    console.error("Erreur TTS:", error);
  }
  return null;
};

export const askGeminiExpert = async (
  docId: string,
  topic: SectionTopic, 
  baseText: string, 
  userQuestion?: string
): Promise<{ text: string }> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return { text: "<strong>Erreur :</strong> Clé API manquante." };

  const ai = new GoogleGenAI({ apiKey });
  
  const docContext = (DOC_CONTEXTS as any)[docId] || "Il s'agit d'un document personnalisé soumis par l'utilisateur pour audit.";
  let fullPrompt = `${docContext}\n\nVoici le texte de la section ${topic} : "${baseText}".\n${TOPIC_CONTEXTS[topic]}`;
  
  if (userQuestion) {
    fullPrompt += `\n\nQUESTION SPÉCIFIQUE DE L'UTILISATEUR : "${userQuestion}"`;
  }

  const generationConfig = {
    systemInstruction: `Tu es un Auditeur Expert International et Consultant Senior au Cameroun. 
    EXPERTISE : Stratégie d'entreprise (OHADA, marché local) et Projets de Santé Publique (MINSANTE, PNDS, POCUS).
    MISSION : Analyser, critiquer de manière constructive et apporter des solutions concrètes pour optimiser les projets soumis.
    RÈGLES DE FORMATAGE :
    1. JAMAIS d'astérisques (*), de dièses (#) ou de tirets (-) en début de ligne.
    2. Utilise UNIQUEMENT <strong></strong> pour mettre en avant des termes clés.
    3. Double saut de ligne entre les paragraphes.
    4. Ton : Professionnel, direct, expert.`,
    temperature: 0.7,
    topP: 0.95,
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [{ parts: [{ text: fullPrompt }] }],
      config: generationConfig,
    });
    
    const cleanedText = cleanResponse(response.text || "");
    return { text: cleanedText };
  } catch (error: any) {
    const fallbackResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: fullPrompt }] }],
      config: generationConfig,
    });
    return { text: cleanResponse(fallbackResponse.text || "") };
  }
};

const cleanResponse = (text: string) => {
  if (!text) return "";
  return text.replace(/\*/g, '').replace(/#/g, '').replace(/-/g, ' ');
};
