const API_KEY = "5b3ce3597851110001cf62483a5bdfdcce0e473a8c7822a4f2e32ad7";
const enderecoBase = "R. Dom João VI, 6 - Santa Cruz, Rio de Janeiro - RJ";

async function buscarEnderecoPorCEP(cep, numero) {
  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);

  if (!response.ok) {
    throw new Error("Erro ao buscar endereço: " + response.statusText);
  }

  const data = await response.json();

  if (data.erro) {
    throw new Error("CEP não encontrado.");
  }

  const enderecoCompleto = `${data.logradouro}, ${numero} - ${data.bairro}, ${data.localidade} - ${data.uf}`;
  const valido = await validarEndereco(enderecoCompleto);

  if (!valido) {
    throw new Error("Endereço inválido ou fora do Brasil.");
  }

  return enderecoCompleto;
}

async function validarEndereco(enderecoCompleto) {
  try {
    const coords = await geocode(enderecoCompleto);
    if (!coords) return false;

    const [lon, lat] = coords;
    return lat < 6 && lat > -35 && lon >= -75 && lon <= -34;
  } catch (error) {
    console.warn("Endereço inválido:", enderecoCompleto, error.message);
    return false;
  }
}

async function geocode(endereco) {
  const response = await fetch(
    `https://api.openrouteservice.org/geocode/search?api_key=${API_KEY}&text=${encodeURIComponent(endereco)}`
  );

  if (!response.ok) {
    throw new Error("Erro ao buscar coordenadas: " + response.statusText);
  }

  const data = await response.json();

  if (!data.features || data.features.length === 0 || !data.features[0].geometry) {
    throw new Error("Endereço não encontrado.");
  }

  return data.features[0].geometry.coordinates; // [lon, lat]
}

async function rota(pontoA, pontoB) {
  const body = { coordinates: [pontoA, pontoB] };

  const response = await fetch(
    "https://api.openrouteservice.org/v2/directions/driving-car",
    {
      method: "POST",
      headers: {
        Authorization: API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    throw new Error("Erro ao buscar rota: " + response.statusText);
  }

  const data = await response.json();

  if (!data.routes || data.routes.length === 0) {
    throw new Error("Rota não encontrada.");
  }

  return data.routes[0].summary.distance / 1000; // em km
}

async function calcular() {
  const cepOrigem = document.getElementById("cep-origem").value.replace(/\D/g, "");
  const numeroOrigem = document.getElementById("numero-origem").value;
  const cepDestino = document.getElementById("cep-destino").value.replace(/\D/g, "");
  const numeroDestino = document.getElementById("numero-destino").value;

  let enderecoOrigemCompleto = "";
  let enderecoDestinoCompleto = "";

  try {
    enderecoOrigemCompleto = await buscarEnderecoPorCEP(cepOrigem, numeroOrigem);
    document.getElementById("origem").value = enderecoOrigemCompleto;
    limparMensagemErro();
  } catch (e) {
    mostrarMensagemErro("Erro com endereço de origem: " + e.message);
    return;
  }

  try {
    enderecoDestinoCompleto = await buscarEnderecoPorCEP(cepDestino, numeroDestino);
    document.getElementById("destino").value = enderecoDestinoCompleto;
    limparMensagemErro();
  } catch (e) {
    mostrarMensagemErro("Erro com endereço de destino: " + e.message);
    return;
  }

  const tipoVeiculo = document.getElementById("tipo").value;
  let taxa = 0;

  if (!enderecoOrigemCompleto || !enderecoDestinoCompleto || !numeroOrigem || !numeroDestino) {
    mostrarMensagemErro("Por favor, preencha todos os campos de endereço e número.");
    return;
  }

  if (tipoVeiculo === "50") {
    taxa = 50;
  } else if (tipoVeiculo === "15") {
    const cilindrada = parseInt(document.getElementById("cilindrada-moto").value);

    if (isNaN(cilindrada)) {
      mostrarMensagemErro("Por favor, informe a cilindrada da moto.");
      return;
    }

    if (cilindrada >= 0 && cilindrada <= 160) taxa = 15;
    else if (cilindrada > 160 && cilindrada <= 250) taxa = 25;
    else if (cilindrada > 250 && cilindrada <= 499) taxa = 35;
    else if (cilindrada >= 500 && cilindrada <= 999) taxa = 50;
    else if (cilindrada >= 1000) taxa = 100;
    else {
      mostrarMensagemErro("Cilindrada inválida.");
      return;
    }
  } else {
    mostrarMensagemErro("Por favor, selecione o tipo de veículo.");
    return;
  }

  document.getElementById("resultado").innerText = "Calculando...";

  try {
    const coordBase = await geocode(enderecoBase);
    const coordOrigem = await geocode(enderecoOrigemCompleto);
    const coordDestino = await geocode(enderecoDestinoCompleto);

    const distanciaBaseOrigem = await rota(coordBase, coordOrigem);
    const distanciaOrigemDestino = await rota(coordOrigem, coordDestino);
    const distanciaDestinoBase = await rota(coordDestino, coordBase);

    const distanciaTotalKm = distanciaBaseOrigem + distanciaOrigemDestino + distanciaDestinoBase;
    const valorKm = distanciaTotalKm * 1.7;
    const valorTotal = valorKm + taxa;

    document.getElementById("resultado").innerText =
      `Distância da Base até a Origem: ${distanciaBaseOrigem.toFixed(2)} km\n` +
      `Distância da Origem até o Destino: ${distanciaOrigemDestino.toFixed(2)} km\n` +
      `Distância do Destino até a Base: ${distanciaDestinoBase.toFixed(2)} km\n` +
      `Distância Total: ${distanciaTotalKm.toFixed(2)} km\n` +
      `Valor por KM (R$ 1,70): R$ ${valorKm.toFixed(2)}\n` +
      `Taxa Fixa: R$ ${taxa.toFixed(2)}\n` +
      `Valor Total Estimado: R$ ${valorTotal.toFixed(2)}`;
  } catch (error) {
    console.error(error);
    document.getElementById("resultado").innerText =
      "Erro ao calcular. Verifique os dados e tente novamente.";
  }
}

function mostrarMensagemErro(message) {
  const mensagemErroDiv = document.getElementById("mensagem-erro");
  mensagemErroDiv.style.display = "block";
  mensagemErroDiv.textContent = message;
}

function limparMensagemErro() {
  const mensagemErroDiv = document.getElementById("mensagem-erro");
  mensagemErroDiv.style.display = "none";
  mensagemErroDiv.textContent = "";
}

document.getElementById("tipo").addEventListener("change", function () {
  const tipo = this.value;
  const detalhesMoto = document.getElementById("detalhes-moto");
  detalhesMoto.style.display = tipo === "15" ? "block" : "none";
});

function abrirWhatsApp() {
  const mensagem = document.getElementById("resultado").innerText;
  const numero = "5521999999999"; // Substitua pelo número real com DDI
  const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
  window.open(url, "_blank");
}

async function buscarEnderecoOrigem() {
  const cep = document.getElementById("cep-origem").value.replace(/\D/g, "");
  const numero = document.getElementById("numero-origem").value;

  try {
    const endereco = await buscarEnderecoPorCEP(cep, numero);
    document.getElementById("origem").value = endereco;
    limparMensagemErro();
  } catch (e) {
    mostrarMensagemErro("Erro com endereço de origem: " + e.message);
  }
}

async function buscarEnderecoDestino() {
  const cep = document.getElementById("cep-destino").value.replace(/\D/g, "");
  const numero = document.getElementById("numero-destino").value;

  try {
    const endereco = await buscarEnderecoPorCEP(cep, numero);
    document.getElementById("destino").value = endereco;
    limparMensagemErro();
  } catch (e) {
    mostrarMensagemErro("Erro com endereço de destino: " + e.message);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  const whatsappSolicitarBtn = document.getElementById('whatsapp-solicitar-btn');
  const cepOrigemInput = document.getElementById('cep-origem');
  const origemInput = document.getElementById('origem');
  const numeroOrigemInput = document.getElementById('numero-origem');
  const cepDestinoInput = document.getElementById('cep-destino');
  const destinoInput = document.getElementById('destino');
  const numeroDestinoInput = document.getElementById('numero-destino');
  const tipoSelect = document.getElementById('tipo');
  const marcaMotoInput = document.getElementById('marca-moto');
  const modeloMotoInput = document.getElementById('modelo-moto');
  const cilindradaMotoInput = document.getElementById('cilindrada-moto');

  whatsappSolicitarBtn.addEventListener('click', function() {
    const cepOrigem = encodeURIComponent(cepOrigemInput.value);
    const ruaOrigem = encodeURIComponent(origemInput.value);
    const numeroOrigem = encodeURIComponent(numeroOrigemInput.value);
    const cepDestino = encodeURIComponent(cepDestinoInput.value);
    const ruaDestino = encodeURIComponent(destinoInput.value);
    const numeroDestino = encodeURIComponent(numeroDestinoInput.value);
    const tipo = encodeURIComponent(tipoSelect.options[tipoSelect.selectedIndex].text);
    const marcaMoto = encodeURIComponent(marcaMotoInput.value);
    const modeloMoto = encodeURIComponent(modeloMotoInput.value);
    const cilindradaMoto = encodeURIComponent(cilindradaMotoInput.value);

    let mensagemWhatsApp = `Olá! Gostaria de solicitar um reboque!%0A%0A` +
      `Local do Veículo:%0ACEP: ${cepOrigem}%0AEndereço: ${ruaOrigem}%0A%0A` +
      `Destino do Reboque:%0ACEP: ${cepDestino}%0AEndereço de Destino: ${ruaDestino}%0A%0A` +
      `Tipo de Veículo: ${tipo}%0A%0A` +
      `Valor Estimado: R$ ${valorTotal ? valorTotal.toFixed(2) : '0,00'}`;

    if (tipoSelect.value === "15") {
      mensagemWhatsApp += `%0AMarca da Moto: ${marcaMoto}%0AModelo da Moto: ${modeloMoto}%0ACilindrada da Moto: ${cilindradaMoto}`;
    }

    const numeroWhatsApp = '552141014470';
    const linkWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${mensagemWhatsApp}`;

    window.open(linkWhatsApp, '_blank');
  });
});

document.getElementById("btn-buscar-origem").addEventListener("click", buscarEnderecoOrigem);
document.getElementById("btn-buscar-destino").addEventListener("click", buscarEnderecoDestino);
document.getElementById("btn-whatsapp").addEventListener("click", abrirWhatsApp);
