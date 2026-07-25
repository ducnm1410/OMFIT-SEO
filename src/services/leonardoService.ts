import { GeneratedImage } from '../types';

export class LeonardoService {
  private apiKey: string;
  private endpoint = 'https://cloud.leonardo.ai/api/rest';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateImage(
    prompt: string,
    style: string,
    referenceImage?: string,
    keyword: string = 'omfit-seo',
    modelId: string = 'nano-banana-2'
  ): Promise<GeneratedImage> {
    try {
      if (!this.apiKey) {
        throw new Error('Leonardo API key is not configured.');
      }

      // We'll map the style from UI to some Leonardo style prompt suffixes
      const styleSuffix =
        style === 'Photorealistic 4K'
          ? 'highly detailed, photorealistic, 4k resolution, cinematic lighting, studio quality, highly detailed photo'
          : style === 'Modern Tech 3D Render'
          ? '3d render, octane render, modern tech, sleek, high quality, 8k'
          : 'corporate, minimalist, clean, professional, high-end photography';

      const finalPrompt = `${prompt}, ${styleSuffix}`;

      const initParams: any = {
        model: modelId,
        parameters: {
          width: 1024,
          height: 1024,
          prompt: finalPrompt,
          quantity: 1,
          prompt_enhance: 'OFF',
          style_ids: [
            "111dc692-d470-4eec-b791-3475abac4c46"
          ]
        },
        public: false
      };
      
      // Note: Leonardo Image to Image API requires presigned URL uploads.
      // In a real application, we would handle the `referenceImage` (base64) by uploading to the presigned URL first.
      // For this Nano Banana 2 configuration, we are using it for direct prompt-based generation as requested.
      if (referenceImage) {
          console.warn('Leonardo reference image upload is not fully implemented in this demo (requires presigned URLs). Ignoring reference image.');
      }

      const generateResponse = await fetch(`${this.endpoint}/v2/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(initParams),
      });

      if (!generateResponse.ok) {
        const errBody = await generateResponse.text();
        throw new Error(`Leonardo API Error: ${generateResponse.status} - ${errBody}`);
      }

      const generateData = await generateResponse.json();
      const generationId = generateData?.generate?.generationId || generateData?.sdGenerationJob?.generationId;

      if (!generationId) {
        throw new Error('Failed to retrieve generationId from Leonardo API');
      }

      // Polling for the generated image
      let imageUrl = null;
      let attempts = 0;
      const maxAttempts = 20;

      while (!imageUrl && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        attempts++;

        const getResponse = await fetch(`${this.endpoint}/v1/generations/${generationId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json'
          }
        });

        if (getResponse.ok) {
          const getData = await getResponse.json();
          const generation = getData?.generations_by_pk;
          
          if (generation?.status === 'COMPLETE') {
            const images = generation?.generated_images;
            if (images && images.length > 0) {
              imageUrl = images[0].url;
            } else {
              throw new Error('Leonardo generated no images');
            }
          } else if (generation?.status === 'FAILED') {
            throw new Error('Leonardo image generation failed');
          }
        }
      }

      if (!imageUrl) {
        throw new Error('Leonardo API timeout waiting for image generation');
      }

      // Fetch the generated image and convert to Base64 so it can be used across the app
      const imageFetchResponse = await fetch(imageUrl);
      const imageBlob = await imageFetchResponse.blob();
      const base64Url = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(imageBlob);
      });

      return {
        id: `img-leo-${Date.now()}`,
        url: base64Url,
        prompt: finalPrompt,
        altText: `OM FIT - ${keyword}: Hình ảnh minh họa cho ${keyword}`,
        fileName: `${keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}.jpg`,
        style: style,
        source: modelId === 'nano-banana-2' ? 'leonardo-nano-banana-2' : 'leonardo-chatgpt-2',
      };
    } catch (error) {
      console.error('Leonardo generation error:', error);
      throw error;
    }
  }
}
