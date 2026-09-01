/**
 * Textos HTML dos documentos do pacote de locação (além do contrato 10 págs).
 * Placeholders: {{NOME}}, {{CPF}}, {{ENDERECO}}, {{PROTOCOLO}}, {{PLACA}}, {{MARCA_MODELO}},
 * {{CHASSI}}, {{RENAVAM}}, {{COR}}, {{ANO_MODELO}}, {{MODALIDADE}}, {{CODIGO_CLIENTE}},
 * {{CELULAR}}, {{CNH}}, {{MUNICIPIO_DATA}}, {{VALOR_ALUGUEL}}, {{VALOR_INVESTIMENTO}},
 * {{KM}}, {{CODIGO_VEICULO}}, {{RG}}, {{CEP}}, {{BAIRRO}}, {{CIDADE}}, {{UF}}, {{EMAIL}},
 * {{CNH_CATEGORIA}}, {{CNH_VALIDADE}}, {{EAR}}, {{RECADO1}}, {{RECADO2}}, {{MARCA}}, {{MODELO}},
 * {{PROPRIETARIO}}, {{CPF_CNPJ_PROP}}, {{MUNICIPIO_VEICULO}}, {{PERIODO_SEMANAS}},
 * {{VALOR_ALUGUEL_EXTENSO}}, {{VALOR_INVESTIMENTO_EXTENSO}}, {{VALOR_SEMANAL}}, {{VALOR_SEMANAL_EXTENSO}},
 * {{VALOR_COMPRA}}, {{VALOR_COMPRA_EXTENSO}}, {{DIA_PAGAMENTO}}, {{DATA_INICIO}}, {{DATA_FIM}}, {{FOTO_VEICULO}},
 * {{FOTO_MODELO_CONTRATADO}}
 */
(function () {
  "use strict";

  window.__DK_CONTRATO_PACOTE_OPCAO = `
<div class="opcao-doc">
  <header class="opcao-cab">
    <img class="opcao-logo" src="{{LOGO_URL}}" alt="DK Locadora" crossorigin="anonymous">
    <div class="opcao-cab-centro">
      <h1>OPÇÃO CONTRATADA</h1>
      <div class="opcao-plano">Plano: {{MODALIDADE}}</div>
      <p class="opcao-proto">Protocolo Nº: {{PROTOCOLO}}</p>
    </div>
    <div class="opcao-foto">{{FOTO_VEICULO}}</div>
  </header>

  <p class="opcao-eu">Eu,</p>
  <p class="opcao-nome">{{NOME}}</p>
  <div class="opcao-grid opcao-grid--2">
    <div class="opcao-cell"><span>Código:</span> {{CODIGO_CLIENTE}}</div>
    <div class="opcao-cell"><span>CPF/CNPJ:</span> {{CPF}}</div>
  </div>
  <div class="opcao-grid opcao-grid--cnh">
    <div class="opcao-cell"><span>Nº da CNH:</span> {{CNH}}</div>
    <div class="opcao-cell"><span>Categoria:</span> {{CNH_CATEGORIA}}</div>
    <div class="opcao-cell"><span>Validade:</span> {{CNH_VALIDADE}}</div>
    <div class="opcao-cell"><span>EAR?:</span> {{EAR}}</div>
  </div>
  <div class="opcao-grid opcao-grid--3">
    <div class="opcao-cell"><span>Nº do Celular:</span> {{CELULAR}}</div>
    <div class="opcao-cell"><span>Recados (1):</span> {{RECADO1}}</div>
    <div class="opcao-cell"><span>Recados (2):</span> {{RECADO2}}</div>
  </div>
  <div class="opcao-grid">
    <div class="opcao-cell opcao-cell--span"><span>Endereço:</span> {{ENDERECO}}</div>
  </div>

  <p class="opcao-frase">opto pelo plano acima sinalizado, referente a Locação do Veículo abaixo especificado:</p>
  <div class="opcao-grid opcao-grid--veic1">
    <div class="opcao-cell"><span>Código:</span> {{CODIGO_VEICULO}}</div>
    <div class="opcao-cell"><span>Placa:</span> {{PLACA}}</div>
    <div class="opcao-cell"><span>Marca / Modelo:</span> {{MARCA_MODELO}}</div>
    <div class="opcao-cell"><span>Odometro:</span> {{KM}}</div>
  </div>
  <div class="opcao-grid opcao-grid--veic2">
    <div class="opcao-cell"><span>Chassi:</span> {{CHASSI}}</div>
    <div class="opcao-cell"><span>Renavam:</span> {{RENAVAM}}</div>
    <div class="opcao-cell"><span>Cor:</span> {{COR}}</div>
    <div class="opcao-cell"><span>Ano/Modelo:</span> {{ANO_MODELO}}</div>
  </div>
  <div class="opcao-grid opcao-grid--veic3">
    <div class="opcao-cell"><span>Proprietário:</span> {{PROPRIETARIO}}</div>
    <div class="opcao-cell"><span>CPF:</span> {{CPF_CNPJ_PROP}}</div>
    <div class="opcao-cell"><span>Município:</span> {{MUNICIPIO_VEICULO}}</div>
  </div>

  <p class="opcao-frase">nas condições abaixo descritas:</p>
  <ul class="opcao-cond">
    <li><span class="opcao-chev">Período do Contrato &gt;&gt;</span> <span class="opcao-val">{{PERIODO_SEMANAS}} SEMANAS</span></li>
    <li><span class="opcao-chev">Valor da Locação (Semanal) &gt;&gt;</span> <span class="opcao-val">{{VALOR_ALUGUEL}} ({{VALOR_ALUGUEL_EXTENSO}})</span></li>
    <li><span class="opcao-chev">Valor do Investimento (Semanal) &gt;&gt;</span> <span class="opcao-val">{{VALOR_INVESTIMENTO}} ({{VALOR_INVESTIMENTO_EXTENSO}})</span></li>
    <li><span class="opcao-chev">Totalizando (Valor Semanal) &gt;&gt;</span> <span class="opcao-val">{{VALOR_SEMANAL}} ({{VALOR_SEMANAL_EXTENSO}})</span></li>
  </ul>
  <p class="opcao-garantia">…referente à garantia de compra pelo valor de {{VALOR_COMPRA}} ({{VALOR_COMPRA_EXTENSO}}) do veículo identificado neste Anexo, ao final do período acima acordado.</p>
  <div class="opcao-atencao">
    <strong>ATENÇÃO:</strong> A garantia de compra prevista neste anexo será automaticamente cancelada na hipótese de descumprimento, pelo LOCATÁRIO, de quaisquer das cláusulas do Contrato de Locação de Veículo, em especial a <strong>Cláusula 10ª (Rescisão)</strong>.
  </div>

  <p class="opcao-obs-tit"><strong>Observações:</strong></p>
  <p class="opcao-obs"><span class="opcao-chev-inline">&gt;</span> Na Troca periódica do Óleo do Motor, o valor do óleo será de responsabilidade do LOCATÁRIO.</p>

  <section class="opcao-termo">
    <h2>Termo de Compromisso</h2>
    <p>Comprometo-me a realizar o pagamento no valor de {{VALOR_SEMANAL}} ({{VALOR_SEMANAL_EXTENSO}}), semanalmente, rigorosamente no(a) {{DIA_PAGAMENTO}}, referente a Locação Semanal, no valor de {{VALOR_ALUGUEL}} ({{VALOR_ALUGUEL_EXTENSO}}), acrescido do valor de {{VALOR_INVESTIMENTO}} ({{VALOR_INVESTIMENTO_EXTENSO}}) referente a um investimento para aquisição do Veículo de Placa: {{PLACA}}, iniciando o contrato no dia {{DATA_INICIO}}, pelo período de {{PERIODO_SEMANAS}} semanas, que terminará no dia {{DATA_FIM}}.</p>
  </section>

  <p class="opcao-data">{{MUNICIPIO_DATA}}</p>
  <div class="opcao-sigs">
    <div class="opcao-sig">
      <div class="opcao-sig-line" aria-hidden="true"></div>
      <p class="opcao-sig-name">{{NOME}}</p>
      <p class="opcao-sig-id">{{CPF}}</p>
    </div>
    <div class="opcao-sig">
      <div class="opcao-sig-line" aria-hidden="true"></div>
      <p class="opcao-sig-name">DK LOCADORA LTDA</p>
      <p class="opcao-sig-id">CNPJ: 59.665.734/0001-32</p>
    </div>
  </div>
</div>`;

  /**
   * Promessa — layout idêntico ao PDF oficial
   * (DK - Modelo de Promessa de Compra e Venda de Ativo Fixo Imobilizado.pdf).
   * Placeholders preenchidos com dados da locação nos mesmos slots visuais.
   */
  window.__DK_CONTRATO_PACOTE_PROMESSA = [
    `<div class="kit-doc kit-promessa">
  <header class="kit-promessa__cab">
    <img class="kit-promessa__logo" src="{{LOGO_URL}}" alt="DK Locadora" crossorigin="anonymous">
    <div class="kit-promessa__cab-txt">
      <h1 class="kit-promessa__titulo">PROMESSA DE COMPRA E VENDA DE ATIVO FIXO IMOBILIZADO</h1>
      <p class="kit-promessa__proto">Protocolo nº {{PROTOCOLO}}</p>
    </div>
  </header>
  <p class="kit-promessa__p">De um lado, <strong>DK LOCADORA LTDA</strong>, pessoa jurídica de direito privado, devidamente inscrita no CNPJ/MF sob o nº
  <strong>59.665.734/0001-32</strong>, com sede na AV. DA REDENÇÃO, SN - ANTÔNIO CASSIMIRO - PETROLINA/PE - CEP: 56.321-440,
  representado na forma de seu Contrato Social, neste ato denominado <strong>LOCADOR</strong>.</p>
  <p class="kit-promessa__p">De outro lado, <strong>{{NOME}}</strong>, CPF: <strong>{{CPF}}</strong>, residente e domiciliado no(a)
  <strong>{{ENDERECO}}</strong>, neste ato denominado <strong>LOCATÁRIO</strong>.</p>
  <p class="kit-promessa__p">Têm entre si, de maneira justa e acordada, o presente <strong>INSTRUMENTO PARTICULAR DE OPÇÃO DE COMPRA DE VEÍCULO</strong>,
  que se regerá pelas cláusulas abaixo descritas.</p>
  <h2 class="kit-promessa__h2">Cláusula 1ª - Objeto do Contrato</h2>
  <p class="kit-promessa__p"><strong>1.1.</strong> O presente contrato tem como OBJETO a opção de compra do veículo a seguir descrito, nas condições em que se encontrar
  ao final do prazo de locação:</p>
  <div class="kit-promessa__veiculo">
    <div class="kit-promessa__campo kit-promessa__campo--placa">
      <span class="kit-promessa__campo-lbl">Placa</span>
      <div class="kit-promessa__campo-box">|___[ <strong>{{PLACA}}</strong> ]___|</div>
    </div>
    <div class="kit-promessa__campo kit-promessa__campo--marca">
      <span class="kit-promessa__campo-lbl">Marca / Modelo</span>
      <div class="kit-promessa__campo-box">|___[ <strong>{{MARCA_MODELO}}</strong> ]___|</div>
    </div>
    <div class="kit-promessa__campo kit-promessa__campo--chassi">
      <span class="kit-promessa__campo-lbl">Chassi</span>
      <div class="kit-promessa__campo-box">|___[ <strong>{{CHASSI}}</strong> ]___|</div>
    </div>
    <div class="kit-promessa__campo kit-promessa__campo--renavam">
      <span class="kit-promessa__campo-lbl">Renavam</span>
      <div class="kit-promessa__campo-box">|___[ <strong>{{RENAVAM}}</strong> ]___|</div>
    </div>
    <div class="kit-promessa__campo kit-promessa__campo--cor">
      <span class="kit-promessa__campo-lbl">Cor</span>
      <div class="kit-promessa__campo-box">|___[ <strong>{{COR}}</strong> ]___|</div>
    </div>
    <div class="kit-promessa__campo kit-promessa__campo--ano">
      <span class="kit-promessa__campo-lbl">Ano/Modelo</span>
      <div class="kit-promessa__campo-box">|___[ <strong>{{ANO_MODELO}}</strong> ]___|</div>
    </div>
  </div>
  <p class="kit-promessa__p"><strong>Parágrafo único:</strong> O veículo/automóvel, objeto do presente contrato, é usado, apresentando um desgaste e envelhecimento
  inerentes aos seus anos de quilometragem.</p>
  <h2 class="kit-promessa__h2">Cláusula 2ª – Da Opção de Compra</h2>
  <p class="kit-promessa__p"><strong>2.1.</strong> Findo o prazo de locação de 150 semanas, fica assegurado ao <strong>LOCATÁRIO</strong>, ora contratante do plano “<strong>{{MODALIDADE}}</strong>”,
  desde que esteja totalmente adimplente com todas as suas obrigações contratuais previstas nos <strong>TERMOS E CONDIÇÕES GERAIS
  DO CONTRATO DE LOCAÇÃO DE VEÍCULOS</strong>, incluindo, mas não se limitando, ao pagamento da locação, multas e quaisquer
  outros valores devidos, o direito de compra do Objeto deste Contrato, pelo preço abaixo determinado conforme previsto na
  cláusula 3ª abaixo.</p>
  <h2 class="kit-promessa__h2">Cláusula 3ª – Do Preço</h2>
  <p class="kit-promessa__p"><strong>3.1.</strong> A opção de compra do veículo acima descrito poderá ser exercida pelo preço de <strong>R$ 20,00 (vinte reais)</strong>.</p>
  <h2 class="kit-promessa__h2">Cláusula 4ª - Da Transferência e do Contrato Definitivo</h2>
  <p class="kit-promessa__p"><strong>4.1.</strong> Findo o prazo de locação e exercida a opção de compra do veículo pelo <strong>LOCATÁRIO</strong>, as Partes se obrigam a assinar um
  instrumento particular definitivo de compra e venda de veículo, desde que observada a cláusula segunda.</p>
  <p class="kit-promessa__p"><strong>4.2.</strong> A posse definitiva será repassada ao <strong>LOCATÁRIO</strong> no momento da assinatura do Instrumento Particular Definitivo de Compra
  e Venda de Veículo.</p>
  <h2 class="kit-promessa__h2">Cláusula 5ª - Das Obrigações do LOCATÁRIO</h2>
  <p class="kit-promessa__p"><strong>5.1.</strong> O <strong>LOCATÁRIO</strong>, pelo presente, se obriga a manter o veículo em perfeitas condições de funcionamento, pelo prazo da locação
  contraída e a cumprir todas as obrigações da locação, incluindo, mas não se limitando, ao pagamento dos montantes devidos.</p>
  <p class="kit-promessa__p"><strong>5.2.</strong> Em qualquer caso, uma vez que o veículo descrito na Cláusula 1a - objeto - na posse do <strong>LOCATÁRIO</strong> desde o termo inicial da
  locação, declara e garante ter plena ciência de estar adquirindo por compra um veículo usado, no estado em que se encontra no
  momento do exercício da opção de compra, não tendo assim, em nenhuma hipótese, nada a reclamar sobre as condições do
  veículo no momento da compra.</p>
  <p class="kit-promessa__p"><strong>5.3.</strong> Será de responsabilidade do <strong>LOCATÁRIO</strong>, os impostos e taxas que incidirem sobre o veículo decorrentes da assinatura do
  Instrumento Particular Definitivo de Compra e Venda de Veículo, inclusive os custos de transferência do veículo.</p>
  <p class="kit-promessa__p"><strong>5.4.</strong> O <strong>LOCATÁRIO</strong> compromete-se, no prazo de 30 (trinta) dias contados da assinatura do instrumento particular definitivo de
  compra e venda de veículo, a providenciar, junto ao DETRAN, o registro da respectiva transferência de propriedade, sob pena, de
  não o fazendo, vir a responder pelos encargos, multas e demais cominações decorrentes de sua omissão.</p>
  <p class="kit-promessa__p"><strong>5.5.</strong> Após a assinatura do Instrumento Particular Definitivo de Compra e Venda de Veículo, o <strong>LOCATÁRIO</strong> se responsabilizará por
  qualquer dano, multas ou quaisquer outras infrações e/ou encargos que venham a recair sobre o veículo ou a terceiros.</p>
</div>`,
    `<div class="kit-doc kit-promessa kit-promessa--p2">
  <h2 class="kit-promessa__h2">Cláusula 6ª – Das Obrigações do Vendedor</h2>
  <p class="kit-promessa__p"><strong>6.1.</strong> Findo o prazo e satisfeitas as condições de locação do veículo, a <strong>LOCADORA</strong> transferirá toda a posse indireta, jus domínio
  para que possa livremente dispor como coisa sua.</p>
  <p class="kit-promessa__p"><strong>6.2.</strong> A <strong>LOCADORA</strong> se obriga a entregar ao <strong>LOCATÁRIO</strong> o Documento Único de Transferência (DUT)/Autorização para
  Transferência de Propriedade de Veículo (ATPV), assinado e com firma reconhecida.</p>
  <p class="kit-promessa__p"><strong>6.3.</strong> A <strong>LOCADORA</strong> se responsabilizará pela entrega do automóvel ao <strong>LOCATÁRIO</strong>, livre de qualquer ônus ou encargo.</p>
  <h2 class="kit-promessa__h2">Cláusula 7ª – Da rescisão</h2>
  <p class="kit-promessa__p"><strong>7.1.</strong> Caso o <strong>LOCATÁRIO</strong> descumpra suas obrigações constantes dos <strong>TERMOS E CONDIÇÕES GERAIS DO CONTRATO DE LOCAÇÃO
  DE VEÍCULOS</strong>, o presente instrumento será rescindido automaticamente e independentemente de notificação prévia.</p>
  <h2 class="kit-promessa__h2">Cláusula 8ª – Condições Gerais</h2>
  <p class="kit-promessa__p"><strong>8.1.</strong> O disposto neste instrumento e seus itens constituem direito intransferível do <strong>LOCATÁRIO</strong>.</p>
  <p class="kit-promessa__p"><strong>8.2.</strong> O presente contrato passa a vigorar entre as partes a partir da sua assinatura, as quais elegem o foro da cidade de Petrolina-
  PE, para dirimir quaisquer dúvidas provenientes da execução e cumprimento do mesmo.</p>
  <p class="kit-promessa__p"><strong>8.3.</strong> As Partes reconhecem e concordam que a assinatura deste Instrumento será formalizada mediante a assinatura do Contrato
  de Locação escolhida a opção do plano “<strong>{{MODALIDADE}}</strong>” pelo <strong>LOCADOR</strong>, sendo as assinaturas físicas consideradas válidas,
  vinculantes e executáveis.</p>
  <p class="kit-promessa__p"><strong>Parágrafo Único:</strong> As Partes renunciam expressamente ao direito de recusar ou contestar a validade do mecanismo previsto nesta
  cláusula, na medida permitida pela legislação aplicável.</p>
  <p class="kit-promessa__fecho">E, por estarem de pleno acordo, as partes assinam a presente PROMESSA DE COMPRA E VENDA DE ATIVO FIXO IMOBILIZADO.</p>
  <p class="kit-promessa__data">{{MUNICIPIO_DATA}}</p>
  <div class="kit-promessa__sigs">
    <div class="kit-promessa__sig">
      <div class="kit-promessa__sig-line" aria-hidden="true"></div>
      <p class="kit-promessa__sig-name"><strong>{{NOME}}</strong></p>
      <p class="kit-promessa__sig-id">CPF: {{CPF}}</p>
    </div>
    <div class="kit-promessa__sig">
      <div class="kit-promessa__sig-line" aria-hidden="true"></div>
      <p class="kit-promessa__sig-name"><strong>DK LOCADORA LTDA</strong></p>
      <p class="kit-promessa__sig-id">CNPJ: 59.665.734/0001-32</p>
    </div>
  </div>
</div>`,
  ];

  /** Requerimento: o pacote usa o PDF oficial (modelos/requerimento-padrao-detran.pdf); HTML legado não é renderizado. */
  window.__DK_CONTRATO_PACOTE_REQUERIMENTO = [];

  /* TERMO DE VISTORIA — duas páginas SISLOC: ENTREGA e DEVOLUÇÃO. MODELO CONTRATADO na cor do veículo. */
  window.__DK_CONTRATO_PACOTE_VISTORIA = `
<div class="vistoria-doc">
  <header class="vistoria-cab">
    <img class="vistoria-logo" src="{{LOGO_URL}}" alt="DK Locadora" crossorigin="anonymous">
    <div class="vistoria-cab-centro">
      <h1>Termo de Vistoria  -  Protocolo Nº: {{PROTOCOLO}}</h1>
      <div class="vistoria-plano">Plano: {{MODALIDADE}}</div>
    </div>
    <div class="vistoria-fase">{{FASE}}</div>
  </header>

  <div class="vistoria-grid vistoria-grid--cli">
    <div class="vistoria-cell"><span>Código - Nome do Cliente</span> Cód.: {{CODIGO_CLIENTE}} - {{NOME}}</div>
    <div class="vistoria-cell"><span>Nº do Celular</span> {{CELULAR}}</div>
    <div class="vistoria-cell"><span>Nº da CNH / Categoria</span> {{CNH}} - Cat.: {{CNH_CATEGORIA}}</div>
  </div>
  <div class="vistoria-grid vistoria-grid--veic">
    <div class="vistoria-cell"><span>Código</span> {{CODIGO_VEICULO}}</div>
    <div class="vistoria-cell"><span>Placa</span> {{PLACA}}</div>
    <div class="vistoria-cell"><span>Marca / Modelo</span> {{MARCA_MODELO}}</div>
    <div class="vistoria-cell"><span>Ano/Modelo</span> {{ANO_MODELO}}</div>
    <div class="vistoria-cell"><span>Cor</span> {{COR}}</div>
  </div>
  <div class="vistoria-grid vistoria-grid--prop">
    <div class="vistoria-cell"><span>Proprietário do Veículo</span> {{PROPRIETARIO}}</div>
    <div class="vistoria-cell"><span>CPF/CNPJ</span> {{CPF_CNPJ_PROP}}</div>
    <div class="vistoria-cell"><span>Município/UF</span> {{MUNICIPIO_VEICULO}}</div>
  </div>

  <div class="vistoria-legenda" aria-label="Legenda">
    <span class="vistoria-leg vistoria-leg--n"><b>N</b> Novo</span>
    <span class="vistoria-leg vistoria-leg--b"><b>B</b> Bom</span>
    <span class="vistoria-leg vistoria-leg--m"><b>M</b> Médio</span>
    <span class="vistoria-leg vistoria-leg--a"><b>A</b> Aprovado</span>
    <span class="vistoria-leg vistoria-leg--r"><b>R</b> Reparar</span>
    <span class="vistoria-leg vistoria-leg--s"><b>S</b> Substituir</span>
  </div>

  <p class="vistoria-sec">Anotações Básicas</p>
  <div class="vistoria-basicas">
    <section class="vistoria-modelo" aria-label="MODELO CONTRATADO">
      <h2>Modelo Contratado</h2>
      <div class="vistoria-modelo__foto">{{FOTO_MODELO_CONTRATADO}}</div>
      <p class="vistoria-modelo__leg">imagem ilustrativa</p>
    </section>
    <div class="vistoria-status">
      <div class="vistoria-odo">
        <span>Odômetro</span>
        <div class="vistoria-odo__val">{{KM_CAMPO}}<i>Km(s)</i></div>
      </div>
      <div class="vistoria-comb">
        <span>Combustível</span>
        <div class="vistoria-comb__bar" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
      </div>
      <table class="vistoria-moto">
        <thead><tr><th>MOTO</th><th>N</th><th class="th-a">A</th><th class="th-b">B</th><th>M</th><th class="th-r">R</th><th class="th-s">S</th></tr></thead>
        <tbody>
          <tr><td>Placa (Trazeira)</td><td class="mk mk-n"></td><td class="mk mk-a"></td><td></td><td></td><td class="mk mk-r"></td><td class="mk mk-s"></td></tr>
          <tr><td>Pneus (Trazeiro)</td><td class="mk mk-n"></td><td></td><td class="mk mk-b"></td><td class="mk mk-m"></td><td></td><td class="mk mk-s"></td></tr>
          <tr><td>Pneus (Dianteiro)</td><td class="mk mk-n"></td><td></td><td class="mk mk-b"></td><td class="mk mk-m"></td><td></td><td class="mk mk-s"></td></tr>
        </tbody>
      </table>
    </div>
    <table class="vistoria-acess">
      <thead><tr><th></th><th colspan="2">Instalado?</th></tr><tr><th></th><th>Sim</th><th>Não</th></tr></thead>
      <tbody>
        <tr><td>Suporte para o Celular</td><td class="mk"></td><td class="mk"></td></tr>
        <tr><td>Carregador para o Celular</td><td class="mk"></td><td class="mk"></td></tr>
        <tr><td>Suporte da Placa</td><td class="mk"></td><td class="mk"></td></tr>
      </tbody>
    </table>
  </div>

  <p class="vistoria-sec">Inspeção de Acessórios / Itens de Segurança / Outros</p>
  <div class="vistoria-itens">{{ITENS_VISTORIA}}</div>
  <div class="vistoria-notas">
    <span>Anotações</span>
    <i></i><i></i><i></i><i></i><i></i>
  </div>

  <p class="vistoria-decl">Declaramos que recebemos o veículo de Placa: {{PLACA}}, nas condições acima citadas e estamos de acordo com as informações contidas neste documento.</p>
  <p class="vistoria-data">{{DATA_LINHA}}</p>
  <div class="vistoria-sigs">
    <div class="vistoria-sig">
      <div class="vistoria-sig-line" aria-hidden="true"></div>
      <p class="vistoria-sig-name">{{NOME}}</p>
      <p class="vistoria-sig-id">CPF/CNPJ: {{CPF}}</p>
    </div>
    <div class="vistoria-sig">
      <div class="vistoria-sig-line" aria-hidden="true"></div>
      <p class="vistoria-sig-name">DK LOCADORA LTDA</p>
      <p class="vistoria-sig-id">CNPJ: 59.665.734/0001-32</p>
    </div>
  </div>
</div>`;
})();
