const Tesseract = require('tesseract.js');

// 在服务端识别图片文字（桌面/PWA 统一走上传接口）
async function recognize(imagePath) {
  const { data: { text } } = await Tesseract.recognize(imagePath, 'chi_sim+eng');
  return text.trim();
}

module.exports = { recognize };
