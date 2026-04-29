/**
 * Leitura assistida de CNH e comprovante (OpenAI Vision).
 * A avaliação de autenticidade é heurística: não substitui perícia nem decisão humana.
 */
(function () {
  const MODEL = "gpt-4o-mini";

  function buildUserPrompt(geo) {
    const geoBlock = geo
      ? `Contexto: geolocalização aproximada do dispositivo — lat ${geo.lat}, lng ${geo.lng}, precisão ${geo.accuracy != null ? `${Math.round(geo.accuracy)} m` : "n/d"}. Use só como referência, não como prova de endereço.`
      : "Geolocalização não foi informada.";

    return `Você analisa documentos brasileiros para cadastro de locadora.

${geoBlock}

Três imagens serão enviadas nesta ordem: (1) frente da CNH, (2) verso da CNH, (3) comprovante de residência.

Tarefas:
1) Na CNH: extraia nome completo do condutor, CPF (só 11 dígitos), número de registro da CNH, categoria, validade no formato dd/mm/aaaa.
2) No comprovante: nome do titular (conta, beneficiário ou endereçamento) e, se visível, CEP, município/UF, logradouro.
3) Compare o nome do titular do comprovante com o nome na CNH. Se forem pessoas claramente diferentes (não só abreviação), defina titularComprovanteDiferenteDaCnh como true e inclua em observacoesAdm o texto exato: "TITULAR DO COMPROVANTE DE RESIDENCIA DIFERENTE DO TITULAR DA HABILITAÇAO" (sem acentos em HABILITACAO e RESIDENCIA, como escrito).
4) Para cada imagem, avalie de forma conservadora se parece documento físico legítimo ou se há sinais de montagem/arte digital (tipografia incoerente, bordas cortadas, baixa qualidade extrema). Não afirme certeza legal. NivelConfianca 0-100.

Responda APENAS com um único JSON válido (sem markdown), seguindo o schema abaixo. Campos desconhecidos: null.`;
  }

  /**
   * @param {string} apiKey
   * @param {{ cnhFrente?: { base64: string, mime: string }, cnhVerso?: { base64: string, mime: string }, comprovante?: { base64: string, mime: string }, geo?: { lat: number, lng: number, accuracy?: number } }} input
   */
  window.dkExtrairCadastroClienteDocumentos = async function (apiKey, input) {
    const key = String(apiKey || "").trim();
    if (!key) throw new Error("Configure a chave OpenAI (área de comprovante / mesma chave do app).");

    const parts = [
      { type: "text", text: buildUserPrompt(input.geo) },
    ];
    const order = [
      { key: "cnhFrente", label: "1) Frente CNH" },
      { key: "cnhVerso", label: "2) Verso CNH" },
      { key: "comprovante", label: "3) Comprovante de residência" },
    ];
    for (const { key: k, label } of order) {
      const blob = input[k];
      parts.push({ type: "text", text: label });
      if (blob && blob.base64 && blob.mime) {
        parts.push({
          type: "image_url",
          image_url: { url: `data:${blob.mime};base64,${blob.base64}` },
        });
      } else {
        parts.push({ type: "text", text: "(imagem ausente)" });
      }
    }

    const schemaHint = `{"nomeCompletoCnh":string|null,"cpf":string|null,"numeroRegistroCnh":string|null,"categoriaCnh":string|null,"validadeCnh":string|null,"nomeTitularComprovanteResidencia":string|null,"enderecoLinha1":string|null,"cep":string|null,"cidadeUf":string|null,"titularComprovanteDiferenteDaCnh":boolean,"observacoesAdm":string[],"autenticidade":{"cnhFrente":{"nivelConfianca":number,"pareceAutentico":boolean,"motivo":string},"cnhVerso":{"nivelConfianca":number,"pareceAutentico":boolean,"motivo":string},"comprovanteResidencia":{"nivelConfianca":number,"pareceAutentico":boolean,"motivo":string}}}`;
    parts[0] = {
      type: "text",
      text: `${parts[0].text}\n\nResponda APENAS com JSON válido neste formato: ${schemaHint}`,
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: parts }],
        response_format: { type: "json_object" },
        max_tokens: 2000,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t.slice(0, 400) || String(res.status));
    }
    const data = await res.json();
    let raw = data.choices?.[0]?.message?.content;
    if (!raw) throw new Error("Resposta vazia da API.");
    raw = String(raw).trim();
    const fence = raw.match(/^```(?:json)?\s*([\s\S]*?)```$/im);
    if (fence) raw = fence[1].trim();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("A IA não retornou JSON válido. Tente fotos mais nítidas ou iluminação melhor.");
    }
    parsed.origem = "openai_cadastro_ia";
    return parsed;
  };
})();
