/**
 * Curated city-coordinates dataset used for radius-based job search.
 * Free and deterministic — no external geocoding API required.
 *
 * To extend coverage, add entries here; the resolver and radius search
 * pick them up automatically. TODO(v2): swap for a real geocoding
 * service behind the same resolveCityFromLocation() interface.
 */
export type KnownCity = {
  /** Canonical display name. */
  name: string;
  /** Lowercase strings matched against job location text. */
  aliases: string[];
  latitude: number;
  longitude: number;
  country: string;
};

export const KNOWN_CITIES: KnownCity[] = [
  // India — NCR
  { name: "Delhi", aliases: ["delhi", "new delhi"], latitude: 28.6139, longitude: 77.209, country: "India" },
  { name: "Noida", aliases: ["noida"], latitude: 28.5355, longitude: 77.391, country: "India" },
  { name: "Greater Noida", aliases: ["greater noida"], latitude: 28.4744, longitude: 77.504, country: "India" },
  { name: "Ghaziabad", aliases: ["ghaziabad"], latitude: 28.6692, longitude: 77.4538, country: "India" },
  { name: "Gurugram", aliases: ["gurugram", "gurgaon"], latitude: 28.4595, longitude: 77.0266, country: "India" },
  { name: "Faridabad", aliases: ["faridabad"], latitude: 28.4089, longitude: 77.3178, country: "India" },

  // India — metros & tech hubs
  { name: "Bengaluru", aliases: ["bengaluru", "bangalore"], latitude: 12.9716, longitude: 77.5946, country: "India" },
  { name: "Mumbai", aliases: ["mumbai", "bombay"], latitude: 19.076, longitude: 72.8777, country: "India" },
  { name: "Hyderabad", aliases: ["hyderabad"], latitude: 17.385, longitude: 78.4867, country: "India" },
  { name: "Chennai", aliases: ["chennai", "madras"], latitude: 13.0827, longitude: 80.2707, country: "India" },
  { name: "Pune", aliases: ["pune"], latitude: 18.5204, longitude: 73.8567, country: "India" },
  { name: "Kolkata", aliases: ["kolkata", "calcutta"], latitude: 22.5726, longitude: 88.3639, country: "India" },
  { name: "Ahmedabad", aliases: ["ahmedabad"], latitude: 23.0225, longitude: 72.5714, country: "India" },
  { name: "Jaipur", aliases: ["jaipur"], latitude: 26.9124, longitude: 75.7873, country: "India" },
  { name: "Indore", aliases: ["indore"], latitude: 22.7196, longitude: 75.8577, country: "India" },
  { name: "Chandigarh", aliases: ["chandigarh", "mohali"], latitude: 30.7333, longitude: 76.7794, country: "India" },
  { name: "Kochi", aliases: ["kochi", "cochin"], latitude: 9.9312, longitude: 76.2673, country: "India" },
  { name: "Thiruvananthapuram", aliases: ["thiruvananthapuram", "trivandrum"], latitude: 8.5241, longitude: 76.9366, country: "India" },
  { name: "Coimbatore", aliases: ["coimbatore"], latitude: 11.0168, longitude: 76.9558, country: "India" },
  { name: "Lucknow", aliases: ["lucknow"], latitude: 26.8467, longitude: 80.9462, country: "India" },
  { name: "Nagpur", aliases: ["nagpur"], latitude: 21.1458, longitude: 79.0882, country: "India" },

  // Americas
  { name: "San Francisco", aliases: ["san francisco", "sf bay", "bay area", "south san francisco"], latitude: 37.7749, longitude: -122.4194, country: "USA" },
  { name: "New York", aliases: ["new york", "nyc", "brooklyn", "manhattan"], latitude: 40.7128, longitude: -74.006, country: "USA" },
  { name: "Seattle", aliases: ["seattle", "bellevue", "redmond"], latitude: 47.6062, longitude: -122.3321, country: "USA" },
  { name: "Austin", aliases: ["austin"], latitude: 30.2672, longitude: -97.7431, country: "USA" },
  { name: "Boston", aliases: ["boston", "cambridge, ma"], latitude: 42.3601, longitude: -71.0589, country: "USA" },
  { name: "Chicago", aliases: ["chicago"], latitude: 41.8781, longitude: -87.6298, country: "USA" },
  { name: "Los Angeles", aliases: ["los angeles", "santa monica"], latitude: 34.0522, longitude: -118.2437, country: "USA" },
  { name: "Denver", aliases: ["denver"], latitude: 39.7392, longitude: -104.9903, country: "USA" },
  { name: "Toronto", aliases: ["toronto"], latitude: 43.6532, longitude: -79.3832, country: "Canada" },
  { name: "Vancouver", aliases: ["vancouver"], latitude: 49.2827, longitude: -123.1207, country: "Canada" },
  { name: "Mexico City", aliases: ["mexico city", "cdmx"], latitude: 19.4326, longitude: -99.1332, country: "Mexico" },
  { name: "São Paulo", aliases: ["sao paulo", "são paulo"], latitude: -23.5505, longitude: -46.6333, country: "Brazil" },

  // Europe
  { name: "London", aliases: ["london"], latitude: 51.5074, longitude: -0.1278, country: "UK" },
  { name: "Dublin", aliases: ["dublin"], latitude: 53.3498, longitude: -6.2603, country: "Ireland" },
  { name: "Berlin", aliases: ["berlin"], latitude: 52.52, longitude: 13.405, country: "Germany" },
  { name: "Munich", aliases: ["munich", "münchen"], latitude: 48.1351, longitude: 11.582, country: "Germany" },
  { name: "Amsterdam", aliases: ["amsterdam"], latitude: 52.3676, longitude: 4.9041, country: "Netherlands" },
  { name: "Paris", aliases: ["paris"], latitude: 48.8566, longitude: 2.3522, country: "France" },
  { name: "Madrid", aliases: ["madrid"], latitude: 40.4168, longitude: -3.7038, country: "Spain" },
  { name: "Lisbon", aliases: ["lisbon", "lisboa"], latitude: 38.7223, longitude: -9.1393, country: "Portugal" },
  { name: "Zurich", aliases: ["zurich", "zürich"], latitude: 47.3769, longitude: 8.5417, country: "Switzerland" },
  { name: "Stockholm", aliases: ["stockholm"], latitude: 59.3293, longitude: 18.0686, country: "Sweden" },
  { name: "Warsaw", aliases: ["warsaw", "warszawa"], latitude: 52.2297, longitude: 21.0122, country: "Poland" },

  // APAC & Middle East
  { name: "Singapore", aliases: ["singapore"], latitude: 1.3521, longitude: 103.8198, country: "Singapore" },
  { name: "Tokyo", aliases: ["tokyo"], latitude: 35.6762, longitude: 139.6503, country: "Japan" },
  { name: "Sydney", aliases: ["sydney"], latitude: -33.8688, longitude: 151.2093, country: "Australia" },
  { name: "Melbourne", aliases: ["melbourne"], latitude: -37.8136, longitude: 144.9631, country: "Australia" },
  { name: "Dubai", aliases: ["dubai"], latitude: 25.2048, longitude: 55.2708, country: "UAE" },
  { name: "Tel Aviv", aliases: ["tel aviv"], latitude: 32.0853, longitude: 34.7818, country: "Israel" },
];

/**
 * Maps a free-text job location (e.g. "Bengaluru, Karnataka, India")
 * to a known city with coordinates. Returns null when no city matches.
 */
export function resolveCityFromLocation(
  location: string | null | undefined
): KnownCity | null {
  if (!location) return null;
  const normalized = location.toLowerCase();

  for (const city of KNOWN_CITIES) {
    if (city.aliases.some((alias) => normalized.includes(alias))) {
      return city;
    }
  }

  return null;
}

export function findCityByName(name: string): KnownCity | null {
  const normalized = name.trim().toLowerCase();
  return (
    KNOWN_CITIES.find(
      (city) =>
        city.name.toLowerCase() === normalized ||
        city.aliases.includes(normalized)
    ) ?? null
  );
}
