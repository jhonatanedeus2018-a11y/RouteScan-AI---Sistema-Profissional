
import { GoogleGenAI, Type } from "@google/genai";
import { DeliveryStop, ExtractionResult } from "../types";

export const extractAddressesFromImage = async (base64DataUrl: string): Promise<ExtractionResult> => {
  // The key is injected at build time by GitHub Actions; it is not requested from each user.
  const apiKey = (process.env.API_KEY || process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("A chave Gemini não foi configurada nesta versão do aplicativo. O administrador precisa cadastrar GEMINI_API_KEY nos Secrets do GitHub e gerar um novo APK.");
  }
  const ai = new GoogleGenAI({ apiKey });
  
  // Extração segura do tipo MIME e dos dados base64
  const matches = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error("O formato da imagem é inválido ou está corrompido.");
  }
  
  const mimeType = matches[1];
  const base64Data = matches[2];

  const EXTRACTION_SCHEMA = {
    type: Type.OBJECT,
    properties: {
      stops: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            stopNumber: {
              type: Type.STRING,
              description: "Identificador EXATO do pacote/parada impresso no mesmo cartão/linha que contém este endereço. Copie os caracteres visíveis sem renumerar nem deduzir."
            },
            address: { type: Type.STRING, description: "O endereço completo (rua e número)." },
            cep: { type: Type.STRING, description: "O CEP (formato 00000-000)." },
            city: { type: Type.STRING, description: "Nome da cidade." },
          },
          required: ["stopNumber", "address", "cep", "city"],
        },
      },
    },
    required: ["stops"],
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data,
              },
            },
            {
              text: "Você é um extrator visual de dados de entregas e deve priorizar a correspondência exata entre pacote e endereço. Leia o print na ordem visual, de cima para baixo. Cada cartão/linha de entrega é um registro independente. Para cada registro, extraia o número/ID do pacote que aparece DENTRO DO MESMO cartão/linha e associe somente ao endereço, CEP e cidade que aparecem nesse mesmo cartão/linha. NUNCA associe um número a um endereço de outra linha, nunca renumere, nunca use o índice da lista como número do pacote e nunca deduza um número que não esteja legível. Se houver um número da parada e um código de rastreio distintos, use o identificador explícito do pacote/parada mostrado junto daquele endereço; não confunda números da barra do sistema, contadores ou números de outras linhas. Preserve os caracteres e dígitos exatamente como aparecem. Não junte dados de cartões diferentes. Se o número ou endereço de uma linha não estiver legível com segurança, não invente nem faça associação aproximada: omita essa linha do resultado. Não descarte registros apenas porque endereços se repetem; vários pacotes podem ter o mesmo endereço, mas cada um precisa manter o próprio identificador visível. Ignore anúncios, mapas e menus do Android. Retorne apenas o JSON no formato solicitado.",
            },
          ],
        },
      ],
      config: {
        systemInstruction: "Você é um sistema de OCR especializado em logística de entregas. Extraia os dados visíveis com rigor. Cada cartão/linha da tela representa uma entrega independente. O stopNumber deve ser copiado exatamente do identificador do pacote/parada que pertence ao mesmo cartão/linha do endereço. Nunca use a posição da linha, o contador total, o índice do array ou números de outra entrega como stopNumber. Não associe campos entre linhas. Se houver vários cartões para o mesmo endereço, preserve cada identificador próprio. Não invente dígitos; se não for possível ler com segurança o identificador ou o endereço, não inclua aquela linha. Preserve os dígitos e caracteres exatamente como aparecem.",
        responseMimeType: "application/json",
        responseSchema: EXTRACTION_SCHEMA,
        temperature: 0.1,
      },
    });

    const jsonStr = (response.text || "").trim();
    if (!jsonStr) throw new Error("A IA não retornou uma resposta. Verifique a chave da API Gemini e tente novamente.");
    const rawParsed = JSON.parse(jsonStr) as { stops: any[] };
    
    if (!rawParsed.stops || !Array.isArray(rawParsed.stops)) {
      return { stops: [] };
    }

    // Process raw AI data and add necessary fields for DeliveryStop type
    const processedStops: DeliveryStop[] = rawParsed.stops.filter((stop) => stop && stop.stopNumber != null && String(stop.stopNumber).trim() !== "" && typeof stop.address === "string" && stop.address.trim() !== "").map((stop, index) => ({
      ...stop,
      id: `stop-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
      stopNumber: String(stop.stopNumber).trim(),
      address: stop.address.trim(),
      cep: String(stop.cep).replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2'), // Garante formato 00000-000
      city: stop.city.trim(),
      confidence: 1.0
    }));

    return { stops: processedStops };
  } catch (error) {
    console.error("Erro na API Gemini:", error);
    if (error instanceof Error && error.message.startsWith("A chave Gemini não foi configurada")) throw error;
    const message = error instanceof Error ? error.message : String(error);
    if (/api.?key|unauthenticated|permission denied|403|401/i.test(message)) {
      throw new Error("A chave da API Gemini está ausente, inválida ou sem permissão. Confira a chave salva no aplicativo.");
    }
    if (/quota|resource.?exhausted|429/i.test(message)) {
      throw new Error("A cota da API Gemini foi atingida. Verifique os limites da sua chave e tente mais tarde.");
    }
    throw new Error("Não foi possível analisar a imagem. Detalhe técnico: " + message.slice(0, 220));
  }
};
