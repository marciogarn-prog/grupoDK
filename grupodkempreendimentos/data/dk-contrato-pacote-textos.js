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

  window.__DK_CONTRATO_PACOTE_PROMESSA = [
    `<div class="kit-doc kit-promessa">
  <h1 class="kit-title">PROMESSA DE COMPRA E VENDA DE ATIVO FIXO IMOBILIZADO</h1>
  <p class="kit-proto">Protocolo nº <strong>{{PROTOCOLO}}</strong></p>
  <p>De um lado, <strong>DK LOCADORA LTDA</strong>, pessoa jurídica de direito privado, devidamente inscrita no CNPJ/MF sob o nº
  <strong>59.665.734/0001-32</strong>, com sede na AV. DA REDENÇÃO, SN - ANTÔNIO CASSIMIRO - PETROLINA/PE - CEP: 56.321-440,
  representado na forma de seu Contrato Social, neste ato denominado <strong>LOCADOR</strong>.</p>
  <p>De outro lado, <strong>{{NOME}}</strong>, CPF: <strong>{{CPF}}</strong>, residente e domiciliado(a) no(a)
  <strong>{{ENDERECO}}</strong>, neste ato denominado <strong>LOCATÁRIO</strong>.</p>
  <p>Têm entre si, de maneira justa e acordada, o presente <strong>INSTRUMENTO PARTICULAR DE OPÇÃO DE COMPRA DE VEÍCULO</strong>,
  que se regerá pelas cláusulas abaixo descritas.</p>
  <h2>Cláusula 1ª - Objeto do Contrato</h2>
  <p>1.1. O presente contrato tem como OBJETO a opção de compra do veículo a seguir descrito, nas condições em que se encontrar ao final do prazo de locação:</p>
  <div class="kit-grid2 kit-veiculo">
    <p><span>Placa</span><strong>{{PLACA}}</strong></p>
    <p><span>Marca / Modelo</span><strong>{{MARCA_MODELO}}</strong></p>
    <p><span>Chassi</span><strong>{{CHASSI}}</strong></p>
    <p><span>Renavam</span><strong>{{RENAVAM}}</strong></p>
    <p><span>Cor</span><strong>{{COR}}</strong></p>
    <p><span>Ano/Modelo</span><strong>{{ANO_MODELO}}</strong></p>
  </div>
  <p><em>Parágrafo único:</em> O veículo/automóvel, objeto do presente contrato, é usado, apresentando um desgaste e envelhecimento inerentes aos seus anos de quilometragem.</p>
  <h2>Cláusula 2ª – Da Opção de Compra</h2>
  <p>2.1. Findo o prazo de locação de 150 semanas, fica assegurado ao LOCATÁRIO, ora contratante do plano “{{MODALIDADE}}”,
  desde que esteja totalmente adimplente com todas as suas obrigações contratuais previstas nos TERMOS E CONDIÇÕES GERAIS DO CONTRATO DE LOCAÇÃO DE VEÍCULOS,
  o direito de compra do Objeto deste Contrato, pelo preço abaixo determinado conforme previsto na cláusula 3ª.</p>
  <h2>Cláusula 3ª – Do Preço</h2>
  <p>3.1. A opção de compra do veículo acima descrito poderá ser exercida pelo preço de <strong>R$ 20,00 (vinte reais)</strong>.</p>
  <h2>Cláusula 4ª - Da Transferência e do Contrato Definitivo</h2>
  <p>4.1. Findo o prazo de locação e exercida a opção de compra do veículo pelo LOCATÁRIO, as Partes se obrigam a assinar um instrumento particular definitivo de compra e venda de veículo, desde que observada a cláusula segunda.</p>
  <p>4.2. A posse definitiva será repassada ao LOCATÁRIO no momento da assinatura do Instrumento Particular Definitivo de Compra e Venda de Veículo.</p>
  <h2>Cláusula 5ª - Das Obrigações do LOCATÁRIO</h2>
  <p>5.1. O LOCATÁRIO obriga-se a manter o veículo em perfeitas condições de funcionamento pelo prazo da locação e a cumprir todas as obrigações da locação.</p>
  <p>5.2. Declara e garante plena ciência de estar adquirindo veículo usado, no estado em que se encontrar no exercício da opção de compra.</p>
  <p>5.3. Será de responsabilidade do LOCATÁRIO os impostos e taxas incidentes sobre o veículo decorrentes da transferência, inclusive custos de transferência.</p>
  <p>5.4. No prazo de 30 (trinta) dias contados da assinatura do instrumento definitivo, o LOCATÁRIO providenciará junto ao DETRAN o registro da transferência de propriedade.</p>
  <p>5.5. Após a assinatura do instrumento definitivo, o LOCATÁRIO responsabilizar-se-á por danos, multas ou encargos que recaiam sobre o veículo ou terceiros.</p>
</div>`,
    `<div class="kit-doc kit-promessa">
  <h2>Cláusula 6ª – Das Obrigações do Vendedor</h2>
  <p>6.1. Findo o prazo e satisfeitas as condições de locação, a LOCADORA transferirá a posse indireta e o domínio para que o LOCATÁRIO possa dispor do bem.</p>
  <p>6.2. A LOCADORA entregará ao LOCATÁRIO o DUT/ATPV assinado e com firma reconhecida.</p>
  <p>6.3. A LOCADORA entregará o automóvel livre de ônus ou encargo.</p>
  <h2>Cláusula 7ª – Da rescisão</h2>
  <p>7.1. Caso o LOCATÁRIO descumpra obrigações dos TERMOS E CONDIÇÕES GERAIS DO CONTRATO DE LOCAÇÃO DE VEÍCULOS, este instrumento será rescindido automaticamente, independentemente de notificação prévia.</p>
  <h2>Cláusula 8ª – Condições Gerais</h2>
  <p>8.1. O disposto neste instrumento constitui direito intransferível do LOCATÁRIO.</p>
  <p>8.2. O presente contrato vigora a partir da assinatura; foro da cidade de Petrolina-PE.</p>
  <p>8.3. As Partes concordam que a assinatura deste Instrumento formaliza-se mediante a assinatura do Contrato de Locação com a opção do plano “{{MODALIDADE}}”.</p>
  <p><em>Parágrafo Único:</em> As Partes renunciam ao direito de contestar a validade deste mecanismo, na medida permitida pela lei.</p>
  <p>E, por estarem de pleno acordo, as partes assinam a presente PROMESSA DE COMPRA E VENDA DE ATIVO FIXO IMOBILIZADO.</p>
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
</div>`,
  ];

  window.__DK_CONTRATO_PACOTE_REQUERIMENTO = [
    `<div class="kit-doc kit-req">
  <h1 class="kit-title">REQUERIMENTO PADRÃO</h1>
  <p class="kit-req__dest">Ilmo. Sr. Diretor Presidente do Departamento Estadual de Trânsito de Pernambuco – DETRAN-PE</p>
  <h2>Identificação do Requerente</h2>
  <div class="kit-grid2">
    <p class="kit-span2"><span>Nome completo</span><strong>{{NOME}}</strong></p>
    <p><span>RG</span><strong>{{RG}}</strong></p>
    <p><span>CPF/CNPJ</span><strong>{{CPF}}</strong></p>
    <p class="kit-span2"><span>Logradouro</span><strong>{{ENDERECO}}</strong></p>
    <p><span>CEP</span><strong>{{CEP}}</strong></p>
    <p><span>Cidade / UF</span><strong>{{CIDADE}} / {{UF}}</strong></p>
    <p><span>Telefone</span><strong>{{CELULAR}}</strong></p>
    <p><span>E-mail</span><strong>{{EMAIL}}</strong></p>
  </div>
  <h2>Identificação do Veículo</h2>
  <div class="kit-grid2">
    <p><span>Placa</span><strong>{{PLACA}}</strong></p>
    <p><span>Chassi</span><strong>{{CHASSI}}</strong></p>
    <p><span>Renavam</span><strong>{{RENAVAM}}</strong></p>
    <p><span>Marca / modelo</span><strong>{{MARCA_MODELO}}</strong></p>
    <p class="kit-span2"><span>Proprietário registrado</span><strong>DK LOCADORA LTDA — CNPJ 59.665.734/0001-32</strong></p>
  </div>
  <h2>Serviço requerido</h2>
  <p class="kit-check"><span class="kit-check__mark">☑</span> Comunicação de Vendas</p>
  <p class="kit-check"><span class="kit-check__mark">☑</span> Transferência</p>
  <p class="kit-hint">Formulário preenchido automaticamente com os dados da locação (protocolo {{PROTOCOLO}}).</p>
</div>`,
    `<div class="kit-doc kit-req">
  <h2>Motivos</h2>
  <p class="kit-motivo">Requer-se o encaminhamento à área competente para comunicação de venda / transferência do veículo placa
  <strong>{{PLACA}}</strong>, chassi <strong>{{CHASSI}}</strong>, renavam <strong>{{RENAVAM}}</strong>, referente ao protocolo de locação
  <strong>{{PROTOCOLO}}</strong> da DK Locadora, em favor de <strong>{{NOME}}</strong>, CPF <strong>{{CPF}}</strong>.</p>
  <h2>Documentos anexos (a apresentar)</h2>
  <ul class="kit-lista">
    <li>Doc. Identidade / CNH</li>
    <li>Doc. CPF</li>
    <li>CRLV / DUT-ATPV</li>
    <li>Comprovante de endereço</li>
    <li>Contrato de locação / promessa de compra</li>
  </ul>
  <p class="kit-data">{{MUNICIPIO_DATA}}</p>
  <div class="sig-area">
    <div class="sig-col">
      <div class="sig-rule" aria-hidden="true"></div>
      <p class="sig-name">{{NOME}}</p>
      <p class="sig-id">Assinatura do requerente</p>
    </div>
    <div class="sig-col">
      <div class="sig-rule" aria-hidden="true"></div>
      <p class="sig-name">DK LOCADORA LTDA</p>
      <p class="sig-id">CNPJ: 59.665.734/0001-32</p>
    </div>
  </div>
  <p class="kit-fine">Assumo total responsabilidade pelas informações acima, conforme o art. 299 do Código Penal.</p>
</div>`,
  ];
})();
