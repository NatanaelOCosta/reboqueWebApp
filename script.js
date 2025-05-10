const API_KEY = "5b3ce3597851110001cf62483a5bdfdcce0e473a8c7822a4f2e32ad7";
const enderecoBase = "R. Dom João VI, 6 - Santa Cruz, Rio de Janeiro - RJ";
let valorTotal = 0;

// Busca o endereço pelo CEP e número
async function buscarEndereco(cep, numero) {
  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  if (!response.ok) throw new Error("Erro ao buscar endereço.");
  const data = await response.json();
  if (data.erro) throw new Error("CEP não encontrado.");

  return `${data.logradouro}, ${numero} - ${data.bairro}, ${data.localidade} - ${data.uf}`;
}

// Converte endereço em coordenadas (lon, lat)
async function geocode(endereco) {
  const response = await fetch(
    `https://api.openrouteservice.org/geocode/search?api_key=${API_KEY}&text=${encodeURIComponent(endereco)}`
  );
  const data = await response.json();
  if (!data.features?.length) throw new Error("Endereço não encontrado.");
  return data.features[0].geometry.coordinates; // [lon, lat]
}

// Calcula rota entre dois pontos
async function rota(pontoA, pontoB) {
  const response = await fetch(
    "https://api.openrouteservice.org/v2/directions/driving-car",
    {
      method: "POST",
      headers: {
        Authorization: API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ coordinates: [pontoA, pontoB] }),
    }
  );

  const data = await response.json();
  if (!data.routes?.length) throw new Error("Rota não encontrada.");
  return data.routes[0].summary.distance / 1000; // km
}

// Mostra mensagem de erro
function mostrarMensagemErro(message) {
  const div = document.getElementById("mensagem-erro");
  div.style.display = "block";
  div.textContent = message;
}

// Limpa mensagem de erro
function limparMensagemErro() {
  const div = document.getElementById("mensagem-erro");
  div.style.display = "none";
  div.textContent = "";
}

// Botões de preenchimento
async function buscarEnderecoOrigem() {
  const cep = document.getElementById("cep-origem").value.replace(/\D/g, "");
  const numero = document.getElementById("numero-origem").value;

  try {
    const endereco = await buscarEndereco(cep, numero);
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
    const endereco = await buscarEndereco(cep, numero);
    document.getElementById("destino").value = endereco;
    limparMensagemErro();
  } catch (e) {
    mostrarMensagemErro("Erro com endereço de destino: " + e.message);
  }
}

// Calcula distância e valor total
async function calcular() {
  const origem = document.getElementById("origem").value.trim();
  const destino = document.getElementById("destino").value.trim();
  const tipo = document.getElementById("tipo").value;

  if (!origem || !destino) {
    mostrarMensagemErro("Preencha os endereços de origem e destino.");
    return;
  }

  let taxa = 0;
  if (tipo === "50") {
    taxa = 50;
  } else if (tipo === "15") {
    const cilindrada = parseInt(document.getElementById("cilindrada-moto").value);
    if (isNaN(cilindrada)) {
      mostrarMensagemErro("Informe a cilindrada da moto.");
      return;
    }
    if (cilindrada <= 160) taxa = 15;
    else if (cilindrada <= 250) taxa = 25;
    else if (cilindrada <= 499) taxa = 35;
    else if (cilindrada <= 999) taxa = 50;
    else taxa = 100;
  } else {
    mostrarMensagemErro("Selecione o tipo de veículo.");
    return;
  }

  document.getElementById("resultado").innerText = "Calculando...";

  try {
    const coordBase = await geocode(enderecoBase);
    const coordOrigem = await geocode(origem);
    const coordDestino = await geocode(destino);

    const d1 = await rota(coordBase, coordOrigem);
    const d2 = await rota(coordOrigem, coordDestino);
    const d3 = await rota(coordDestino, coordBase);

    const distanciaTotal = d1 + d2 + d3;
    const valorKm = distanciaTotal * 1.7;
    valorTotal = valorKm + taxa;

    document.getElementById("resultado").innerText =
      `Distância total: ${distanciaTotal.toFixed(2)} km\n` +
      `Valor por KM: R$ ${valorKm.toFixed(2)}\n` +
      `Taxa Fixa: R$ ${taxa.toFixed(2)}\n` +
      `Valor Total Estimado: R$ ${valorTotal.toFixed(2)}`;
  } catch (e) {
    mostrarMensagemErro("Erro ao calcular: " + e.message);
  }
}

// WhatsApp
function enviarMensagemWhatsApp() {
  const origem = document.getElementById("origem").value;
  const destino = document.getElementById("destino").value;
  const tipo = document.getElementById("tipo").value;
  const tipoTexto = document.getElementById("tipo").options[document.getElementById("tipo").selectedIndex].text;

  let mensagem = `Olá! Gostaria de solicitar um reboque!\n\n` +
    `Origem: ${origem}\nDestino: ${destino}\n` +
    `Tipo de veículo: ${tipoTexto}\n`;

  if (tipo === "15") {
    const marca = document.getElementById("marca-moto").value;
    const modelo = document.getElementById("modelo-moto").value;
    const cilindrada = document.getElementById("cilindrada-moto").value;
    mensagem += `Moto: ${marca} ${modelo}, ${cilindrada}cc\n`;
  }

  mensagem += `\nValor estimado: R$ ${valorTotal.toFixed(2)}`;
  const link = `https://wa.me/552141014470?text=${encodeURIComponent(mensagem)}`;
  window.open(link, "_blank");
}

// Exibir campos extras conforme tipo
document.getElementById("tipo").addEventListener("change", function () {
  const isMoto = this.value === "15";
  document.getElementById("detalhes-moto").style.display = isMoto ? "block" : "none";
});

// Botões
document.getElementById("btn-buscar-origem").addEventListener("click", buscarEnderecoOrigem);
document.getElementById("btn-buscar-destino").addEventListener("click", buscarEnderecoDestino);
document.getElementById("whatsapp-solicitar-btn").addEventListener("click", enviarMensagemWhatsApp);
