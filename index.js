import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const ORS_API_KEY = '5b3ce3597851110001cf62483a5bdfdcce0e473a8c7822a4f2e32ad7';

// Geocodificação
app.get('/geocode', async (req, res) => {
  const { endereco } = req.query;

  try {
    const response = await fetch(`https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${encodeURIComponent(endereco)}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ erro: 'Erro na geocodificação', detalhe: error.message });
  }
});

// Cálculo de rota
app.get('/rota', async (req, res) => {
  const { lat1, lon1, lat2, lon2 } = req.query;

  try {
    const response = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
      method: 'POST',
      headers: {
        'Authorization': ORS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        coordinates: [
          [parseFloat(lon1), parseFloat(lat1)],
          [parseFloat(lon2), parseFloat(lat2)]
        ]
      })
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ erro: 'Erro no cálculo de rota', detalhe: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));