import client from '../../../api/client';

export const TrekService = {
  getTrek: async (trekId) => {
    const res = await client.get(`/treks/${trekId}`);
    return res.data;
  },

  startTrek: async (trekData) => {
    const res = await client.post('/treks/start', trekData);
    return res.data;
  },

  updateTrek: async (trekId, updateData) => {
    const res = await client.put(`/treks/update/${trekId}`, updateData);
    return res.data;
  },

  createPost: async (postData) => {
    const res = await client.post('/posts/create', postData);
    return res.data;
  },

  fetchRoadRoute: async (start, end) => {
    const url = `https://router.project-osrm.org/route/v1/foot/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      return data.routes[0].geometry.coordinates.map(p => ({
        latitude: p[1],
        longitude: p[0]
      }));
    }
    return null;
  }
};
