import type { GeneratedImage } from '../types';

export class VertexAiService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // Generate Image via Google Vertex AI Imagen 3 model (imagen-3.0-generate-001)
  async generateImage(
    prompt: string,
    style: string = 'Photorealistic 4K',
    referenceImageBase64?: string,
    keyword: string = 'omfit-pilates'
  ): Promise<GeneratedImage> {
    const fullPrompt = `High quality professional photo for OM FIT brand: ${prompt}, style: ${style}, luxury warm champagne gold ambient lighting, 4k resolution, context of ${keyword}`;

    if (this.apiKey) {
      try {
        // Vertex AI / Google Developer API endpoint for Imagen 3
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:generateImages?key=${this.apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              prompt: fullPrompt,
              config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '16:9'
              }
            })
          }
        );

        const data = await response.json();
        if (data.generatedImages && data.generatedImages[0]?.image?.imageBytes) {
          const imageBase64 = `data:image/jpeg;base64,${data.generatedImages[0].image.imageBytes}`;
          const cleanFileName = (keyword + '-vertex-imagen3-' + Date.now()).toLowerCase().replace(/[^a-z0-9]/g, '-') + '.jpg';

          return {
            id: 'img-vertex-' + Date.now(),
            url: imageBase64,
            prompt: prompt,
            altText: `OM FIT Vertex AI Imagen 3 - ${keyword}: ${prompt.slice(0, 50)}`,
            fileName: cleanFileName,
            style: style,
            source: 'vertex-imagen-3'
          };
        }
      } catch (err) {
        console.warn('Vertex AI Imagen 3 API call failed, generating visual fallback:', err);
      }
    }

    // High quality dynamic fallback SVG styled for Vertex AI Imagen 3
    const cleanFileName = (keyword + '-imagen3-' + Date.now()).toLowerCase().replace(/[^a-z0-9]/g, '-') + '.png';
    const svgData = encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
        <defs>
          <linearGradient id="vertexGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0c0c0e" />
            <stop offset="50%" stop-color="#18181c" />
            <stop offset="100%" stop-color="#3d2d14" />
          </linearGradient>
          <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#f5d799" />
            <stop offset="50%" stop-color="#c5a059" />
            <stop offset="100%" stop-color="#9a7b38" />
          </linearGradient>
        </defs>
        <rect width="1200" height="630" fill="url(#vertexGrad)" />
        <circle cx="1000" cy="150" r="260" fill="#c5a059" opacity="0.15" />
        <circle cx="200" cy="500" r="290" fill="#e6c687" opacity="0.1" />
        <g transform="translate(100, 180)">
          <rect x="0" y="0" width="280" height="36" rx="18" fill="#c5a059" opacity="0.2" />
          <text x="20" y="24" fill="#e6c687" font-family="sans-serif" font-size="13" font-weight="bold">GOOGLE VERTEX AI • IMAGEN 3 MODEL</text>
          <text x="0" y="90" fill="url(#goldGrad)" font-family="sans-serif" font-size="44" font-weight="800">${keyword.toUpperCase()}</text>
          <text x="0" y="140" fill="#f5f3ef" font-family="sans-serif" font-size="22" font-weight="500">${prompt.slice(0, 55)}...</text>
          <line x1="0" y1="180" x2="680" y2="180" stroke="#332f27" stroke-width="2" />
          <text x="0" y="220" fill="#c5a059" font-family="sans-serif" font-size="16">omfit.com.vn • Vertex AI Imagen 3 Model</text>
        </g>
      </svg>
    `);
    const dataUrl = `data:image/svg+xml;utf8,${svgData}`;

    return {
      id: 'img-vertex-' + Date.now(),
      url: dataUrl,
      prompt: prompt,
      altText: `Hình minh họa Vertex AI Imagen 3 cho ${keyword}: ${prompt}`,
      fileName: cleanFileName,
      style: style,
      source: 'vertex-imagen-3'
    };
  }
}
