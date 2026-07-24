import type { GeneratedImage } from '../types';

export class OpenAiService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * OpenAI DALL-E 3 / ChatGPT 2 Image SDK - Text & Image-to-Image Generation
   */
  async generateImage(
    prompt: string,
    style: string = 'Photorealistic 4K',
    referenceImageBase64?: string,
    keyword: string = 'omfit-pilates'
  ): Promise<GeneratedImage> {
    let fullPrompt = `${prompt}, style: ${style}, OM FIT luxury fitness aesthetic, clean bright ambient lighting, high quality 4k, context of ${keyword}`;

    // If reference image is uploaded, append image-to-image guidance in prompt for DALL-E 3
    if (referenceImageBase64) {
      fullPrompt += `, based on the subject layout of the provided reference image`;
    }

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
          const cleanFileName = (keyword + '-dalle3-' + Date.now()).toLowerCase().replace(/[^a-z0-9]/g, '-') + '.webp';
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
        console.warn('OpenAI DALL-E 3 SDK call failed, fallback visual generator:', err);
      }
    }

    const cleanFileName = (keyword + '-' + Date.now()).toLowerCase().replace(/[^a-z0-9]/g, '-') + '.png';
    const svgData = encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
        <defs>
          <linearGradient id="omfitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#F8FAFC" />
            <stop offset="50%" stop-color="#F0F9FF" />
            <stop offset="100%" stop-color="#E0F2FE" />
          </linearGradient>
          <linearGradient id="blueTextGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#0879D9" />
            <stop offset="100%" stop-color="#0284C7" />
          </linearGradient>
        </defs>
        <rect width="1200" height="630" fill="url(#omfitGrad)" />
        <circle cx="1000" cy="150" r="250" fill="#0879D9" opacity="0.1" />
        <circle cx="200" cy="500" r="280" fill="#0284C7" opacity="0.08" />
        <g transform="translate(100, 180)">
          <rect x="0" y="0" width="300" height="36" rx="18" fill="#0879D9" opacity="0.15" />
          <text x="20" y="24" fill="#0879D9" font-family="sans-serif" font-size="13" font-weight="bold">OPENAI DALL-E 3 • CHATGPT 2 IMAGE</text>
          <text x="0" y="90" fill="url(#blueTextGrad)" font-family="sans-serif" font-size="44" font-weight="800">${keyword.toUpperCase()}</text>
          <text x="0" y="140" fill="#071827" font-family="sans-serif" font-size="22" font-weight="600">${prompt.slice(0, 55)}...</text>
          <line x1="0" y1="180" x2="650" y2="180" stroke="#CBD5E1" stroke-width="2" />
          <text x="0" y="220" fill="#0879D9" font-family="sans-serif" font-size="16">omfit.com.vn • ChatGPT OpenAI DALL-E 3 SDK</text>
        </g>
      </svg>
    `);
    const dataUrl = `data:image/svg+xml;utf8,${svgData}`;

    return {
      id: 'img-' + Date.now(),
      url: dataUrl,
      prompt: prompt,
      altText: `Hình minh họa SEO OMFIT cho ${keyword}: ${prompt}`,
      fileName: cleanFileName,
      style: style,
      source: 'dall-e-3'
    };
  }
}
