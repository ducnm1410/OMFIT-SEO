// Năng lực của các model tạo ảnh Leonardo — nguồn sự thật duy nhất.
//
// Đặt trong src/lib/ (như runtimeEnv.mjs) vì cả server lẫn UI phải đồng ý từng
// con số: UI dựa vào đây để chỉ cho chọn cấu hình hợp lệ, server dựa vào đây để
// validate lại và dựng request gửi Leonardo. Hai bên lệch nhau thì user chọn
// được size mà server lại nắn sang size khác — im lặng và rất khó truy.
//
// Bảng độ phân giải port từ shared/imageModels.ts của hệ thống gssea-gamehub —
// đã verify với API thật ở cả hai nơi.

export const NANO_BANANA = 'nano-banana-2';
export const GPT_IMAGE = 'gpt-image-2';

/** Thứ tự model hiển thị trên UI */
export const IMAGE_MODEL_ORDER = [GPT_IMAGE, NANO_BANANA];

/** Thứ tự tier từ nhỏ đến lớn — dùng khi phải hạ độ phân giải cho hợp model */
export const QUALITY_TIERS = ['1k', '2k', '4k'];

export const NANO_BANANA_RESOLUTIONS = {
  '1:1':  { '1k': { w: 1024, h: 1024 }, '2k': { w: 2048, h: 2048 }, '4k': { w: 4096, h: 4096 } },
  '2:3':  { '1k': { w: 848,  h: 1264 }, '2k': { w: 1696, h: 2528 }, '4k': { w: 3392, h: 5056 } },
  '3:2':  { '1k': { w: 1264, h: 848  }, '2k': { w: 2528, h: 1696 }, '4k': { w: 5056, h: 3392 } },
  '3:4':  { '1k': { w: 896,  h: 1200 }, '2k': { w: 1792, h: 2400 }, '4k': { w: 3584, h: 4800 } },
  '4:3':  { '1k': { w: 1200, h: 896  }, '2k': { w: 2400, h: 1792 }, '4k': { w: 4800, h: 3584 } },
  '4:5':  { '1k': { w: 928,  h: 1152 }, '2k': { w: 1856, h: 2304 }, '4k': { w: 3712, h: 4608 } },
  '5:4':  { '1k': { w: 1152, h: 928  }, '2k': { w: 2304, h: 1856 }, '4k': { w: 4608, h: 3712 } },
  '9:16': { '1k': { w: 768,  h: 1376 }, '2k': { w: 1536, h: 2752 }, '4k': { w: 3072, h: 5504 } },
  '16:9': { '1k': { w: 1376, h: 768  }, '2k': { w: 2752, h: 1536 }, '4k': { w: 5504, h: 3072 } },
  '21:9': { '1k': { w: 1584, h: 672  }, '2k': { w: 3168, h: 1344 }, '4k': { w: 6336, h: 2688 } }
};

// Bảng RIÊNG cho gpt-image-2.
// Docs Leonardo ghi model nhận mọi kích thước là bội số của 16 — SAI. API thật
// chỉ nhận một allowlist width/height cố định (và hai danh sách này khác nhau),
// nên nhân đôi từ 1K như bảng nano-banana-2 sẽ bị từ chối ở 9/10 tỉ lệ.
// Quan trọng: allowlist KHÔNG chặn trần pixel — size vượt 8.29MP vẫn qua được
// validate rồi mới FAILED lúc render (đã kiểm chứng: 3584x3584 và 3808x2880
// đều qua validate nhưng generation FAILED). Mỗi ô dưới đây là cặp lớn nhất
// trong allowlist khớp tỉ lệ (lệch <1%) mà vẫn dưới trần 8.29MP.
export const GPT_IMAGE_RESOLUTIONS = {
  '1:1':  { '1k': { w: 1024, h: 1024 }, '2k': { w: 2048, h: 2048 }, '4k': { w: 2880, h: 2880 } },
  '2:3':  { '1k': { w: 848,  h: 1264 }, '2k': { w: 1696, h: 2560 }, '4k': { w: 2336, h: 3504 } },
  '3:2':  { '1k': { w: 1264, h: 848  }, '2k': { w: 2560, h: 1696 }, '4k': { w: 3504, h: 2336 } },
  '3:4':  { '1k': { w: 896,  h: 1200 }, '2k': { w: 1536, h: 2048 }, '4k': { w: 2448, h: 3264 } },
  '4:3':  { '1k': { w: 1200, h: 896  }, '2k': { w: 2448, h: 1824 }, '4k': { w: 3264, h: 2448 } },
  '4:5':  { '1k': { w: 928,  h: 1152 }, '2k': { w: 1856, h: 2336 }, '4k': { w: 2560, h: 3200 } },
  '5:4':  { '1k': { w: 1152, h: 928  }, '2k': { w: 2336, h: 1856 }, '4k': { w: 3200, h: 2560 } },
  '9:16': { '1k': { w: 768,  h: 1376 }, '2k': { w: 1376, h: 2448 }, '4k': { w: 2016, h: 3584 } },
  '16:9': { '1k': { w: 1376, h: 768  }, '2k': { w: 2448, h: 1376 }, '4k': { w: 3584, h: 2016 } },
  '21:9': { '1k': { w: 1584, h: 672  }, '2k': { w: 2016, h: 864  }, '4k': { w: 3808, h: 1648 } }
};

export const GPT_IMAGE_LIMITS = { maxPixels: 8294400, maxRatio: 3 };

/** Kích thước phải nằm trong bảng của model và thoả trần pixel / tỉ lệ */
export function isValidGptImageSize(w, h) {
  if (Math.max(w, h) / Math.min(w, h) > GPT_IMAGE_LIMITS.maxRatio) return false;
  return w * h <= GPT_IMAGE_LIMITS.maxPixels;
}

export const IMAGE_MODEL_CAPS = {
  [NANO_BANANA]: {
    label: 'Nano Banana 2',
    hint: 'Bám ảnh tham chiếu tốt, hỗ trợ tới 4096px',
    resolutions: NANO_BANANA_RESOLUTIONS,
    tierLabels: { '1k': '1K', '2k': '2K', '4k': '4K' },
    maxRefs: 4,
    maxPrompt: 1500,
    renderQualities: null,
    refStrength: 'HIGH',
    isSizeSupported: () => true
  },
  [GPT_IMAGE]: {
    label: 'GPT Image 2',
    hint: 'Chữ trên banner sắc nét hơn, trần 8.29MP',
    resolutions: GPT_IMAGE_RESOLUTIONS,
    tierLabels: { '1k': '1K', '2k': '2K', '4k': 'Max' },
    maxRefs: 6,
    maxPrompt: 1500,
    renderQualities: [
      { label: 'Low', value: 'LOW' },
      { label: 'Medium', value: 'MEDIUM' },
      { label: 'High', value: 'HIGH' }
    ],
    refStrength: null,
    isSizeSupported: (size, tier) => {
      const c = GPT_IMAGE_RESOLUTIONS[size]?.[tier];
      return !!c && isValidGptImageSize(c.w, c.h);
    }
  }
};

/** Model lạ (client cũ, API key gọi thẳng) rơi về gpt-image-2 */
export const capsOf = (model) => IMAGE_MODEL_CAPS[model] || IMAGE_MODEL_CAPS[GPT_IMAGE];

export const isImageModel = (model) => typeof model === 'string' && !!IMAGE_MODEL_CAPS[model];

/** Các tier model dùng được với một tỉ lệ, giữ thứ tự nhỏ → lớn */
export const supportedTiers = (model, size) =>
  QUALITY_TIERS.filter((tier) => capsOf(model).isSizeSupported(size, tier));

/** Tier cao nhất còn hợp lệ, dùng khi phải hạ cấu hình cho vừa model */
export const highestSupportedTier = (model, size) => supportedTiers(model, size).pop();

/** Kích thước cuối cùng gửi lên Leonardo, đã nắn về vùng hợp lệ của model */
export function resolveResolution(model, size, tier) {
  const caps = capsOf(model);
  const table = caps.resolutions;
  const direct = table[size]?.[tier];
  if (direct && caps.isSizeSupported(size, tier)) return direct;

  const safeTier = highestSupportedTier(model, size);
  if (safeTier && table[size]?.[safeTier]) return table[size][safeTier];

  return table['16:9']['1k'];
}
