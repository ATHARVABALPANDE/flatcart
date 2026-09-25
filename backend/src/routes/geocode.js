import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ah } from '../asyncHandler.js';

const router = Router();
router.use(requireAuth);

// Reverse-geocode lat/long to a postal code using OpenStreetMap's free Nominatim
// service (no API key needed). Used so households only have to share their
// location once instead of typing a pincode by hand.
router.get('/reverse', ah(async (req, res) => {
  const { lat, lon } = req.query;
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);
  if (isNaN(latitude) || isNaN(longitude)) {
    return res.status(400).json({ error: 'lat and lon query params are required numbers' });
  }

  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(latitude),
    lon: String(longitude),
    zoom: '18',
    addressdetails: '1',
  });

  let data;
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: { 'User-Agent': 'FlatCart/1.0 (flatmate shopping list app)' },
      signal: AbortSignal.timeout(8000),
    });
    data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(502).json({ error: `Reverse geocoding failed (${response.status})` });
    }
  } catch (err) {
    return res.status(502).json({ error: `Could not reach geocoding service: ${err.message}` });
  }

  const pincode = data?.address?.postcode || null;
  const displayName = data?.display_name || null;
  res.json({ pincode, displayName });
}));

export default router;
