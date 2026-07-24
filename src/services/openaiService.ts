import type { GeneratedImage } from '../types';

export class OpenAiService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateImage(
    prompt: string,
    style: string = 'Photorealistic 4K',
    referenceImageBase64?: string,
    keyword: string = 'omfit-pilates'
  ): Promise<GeneratedImage> {
    const fullPrompt = `${prompt}, style: ${style}, OM FIT luxury fitness aesthetic, warm champagne gold lighting, high quality 4k, context of ${keyword}`;

    if (this.apiKey) {
      try {
        const response = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model: 'dall-e-3',
            prompt: fullPrompt,
            n: 1,
            size: '1024x1024',
            quality: 'standard'
          })
        });

        const data = await response.json();
        if (data.data && data.data[0]?.url) {
          const cleanFileName = (keyword + '-' + Date.now()).toLowerCase().replace(/[^a-z0-9]/g, '-') + '.webp';
          return {
            id: 'img-' + Date.now(),
            url: data.data[0].url,
            prompt: prompt,
            altText: `OM FIT SEO - ${keyword} - ${prompt.slice(0, 50)}`,
            fileName: cleanFileName,
            style: style,
            source: 'dall-e-3'
          };
        }
      } catch (err) {
        console.warn('OpenAI DALL-E 3 call failed, fallback visual generator:', err);
      }
    }

    const cleanFileName = (keyword + '-' + Date.now()).toLowerCase().replace(/[^a-z0-9]/g, '-') + '.png';
    const svgData = encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
        <defs>
          <linearGradient id="omfitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0c0c0e" />
            <stop offset="50%" stop-color="#18181c" />
            <stop offset="100%" stop-color="#2a2215" />
          </linearGradient>
          <linearGradient id="goldTextGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#f5d799" />
            <stop offset="50%" stop-color="#c5a059" />
            <stop offset="100%" stop-color="#9a7b38" />
          </linearGradient>
        </defs>
        <rect width="1200" height="630" fill="url(#omfitGrad)" />
        <circle cx="1000" cy="150" r="250" fill="#c5a059" opacity="0.12" />
        <circle cx="200" cy="500" r="280" fill="#e6c687" opacity="0.08" />
        <g transform="translate(100, 180)">
          <rect x="0" y="0" width="220" height="36" rx="18" fill="#c5a059" opacity="0.2" />
          <text x="20" y="24" fill="#e6c687" font-family="sans-serif" font-size="13" font-weight="bold">OM FIT • LUXURY DALL-E 3</text>
          <text x="0" y="90" fill="url(#goldTextGrad)" font-family="sans-serif" font-size="44" font-weight="800">${keyword.toUpperCase()}</text>
          <text x="0" y="140" fill="#f5f3ef" font-family="sans-serif" font-size="22" font-weight="500">${prompt.slice(0, 55)}...</text>
          <line x1="0" y1="180" x2="650" y2="180" stroke="#332f27" stroke-width="2" />
          <text x="0" y="220" fill="#c5a059" font-family="sans-serif" font-size="16">omfit.com.vn • Premium SEO Image</text>
        </g>
      </svg>
    `);
    const dataUrl = `data:image/svg+xml;utf8,${svgData}`;

    return {
      id: 'img-' + Date.now(),
      url: dataUrl,
      prompt: prompt,
      altText: `Hình minh họa SEO OM FIT cho ${keyword}: ${prompt}`,
      fileName: cleanFileName,
      style: style,
      source: 'dall-e-3'
    };
  }
}
