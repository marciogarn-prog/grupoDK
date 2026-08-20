/**
 * Textos HTML dos documentos do pacote de locação (além do contrato 10 págs).
 * Placeholders: {{NOME}}, {{CPF}}, {{ENDERECO}}, {{PROTOCOLO}}, {{PLACA}}, {{MARCA_MODELO}},
 * {{CHASSI}}, {{RENAVAM}}, {{COR}}, {{ANO_MODELO}}, {{MODALIDADE}}, {{CODIGO_CLIENTE}},
 * {{CELULAR}}, {{CNH}}, {{MUNICIPIO_DATA}}, {{VALOR_ALUGUEL}}, {{VALOR_INVESTIMENTO}},
 * {{KM}}, {{CODIGO_VEICULO}}, {{RG}}, {{CEP}}, {{BAIRRO}}, {{CIDADE}}, {{UF}}, {{EMAIL}}
 */
(function () {
  "use strict";

  window.__DK_CONTRATO_PACOTE_OPCAO = `
<div class="kit-doc kit-opcao">
  <header class="kit-opcao__head">
    <h1>OPÇÃO CONTRATADA</h1>
    <p class="kit-opcao__plano"><strong>Plano:</strong> {{MODALIDADE}}</p>
    <p class="kit-opcao__proto"><strong>Protocolo:</strong> {{PROTOCOLO}}</p>
  </header>
  <section class="kit-box">
    <h2>Locatário</h2>
    <div class="kit-grid2">
      <p><span>Nome</span><strong>{{NOME}}</strong></p>
      <p><span>Cód. cliente</span><strong>{{CODIGO_CLIENTE}}</strong></p>
      <p><span>CPF</span><strong>{{CPF}}</strong></p>
      <p><span>CNH</span><strong>{{CNH}}</strong></p>
      <p><span>Celular</span><strong>{{CELULAR}}</strong></p>
      <p class="kit-span2"><span>Endereço</span><strong>{{ENDERECO}}</strong></p>
    </div>
  </section>
  <section class="kit-box">
    <h2>Veículo</h2>
    <div class="kit-grid2">
      <p><span>Cód. veículo</span><strong>{{CODIGO_VEICULO}}</strong></p>
      <p><span>Placa</span><strong>{{PLACA}}</strong></p>
      <p><span>Marca / modelo</span><strong>{{MARCA_MODELO}}</strong></p>
      <p><span>Km</span><strong>{{KM}}</strong></p>
      <p><span>Chassi</span><strong>{{CHASSI}}</strong></p>
      <p><span>Renavam</span><strong>{{RENAVAM}}</strong></p>
      <p><span>Cor</span><strong>{{COR}}</strong></p>
      <p><span>Ano / modelo</span><strong>{{ANO_MODELO}}</strong></p>
    </div>
  </section>
  <section class="kit-box">
    <h2>Condições financeiras</h2>
    <div class="kit-grid2">
      <p><span>Valor do aluguel</span><strong>{{VALOR_ALUGUEL}}</strong></p>
      <p><span>Valor investimento</span><strong>{{VALOR_INVESTIMENTO}}</strong></p>
      <p><span>Prazo</span><strong>150 semanas</strong></p>
      <p><span>Opção de compra</span><strong>R$ 20,00</strong></p>
    </div>
  </section>
  <p class="kit-termo">Declaro estar ciente das condições do plano {{MODALIDADE}}, protocolo {{PROTOCOLO}}, placa {{PLACA}}.</p>
  <p class="kit-data">{{MUNICIPIO_DATA}}</p>
  <div class="sig-area">
    <div class="sig-col">
      <div class="sig-rule" aria-hidden="true"></div>
      <p class="sig-name">{{NOME}}</p>
      <p class="sig-id">{{CPF}}</p>
    </div>
    <div class="sig-col">
      <div class="sig-rule" aria-hidden="true"></div>
      <p class="sig-name">DK LOCADORA LTDA</p>
      <p class="sig-id">CNPJ: 59.665.734/0001-32</p>
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
})();
