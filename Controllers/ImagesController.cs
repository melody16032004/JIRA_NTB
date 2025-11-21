using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Hosting; // Cần cho IWebHostEnvironment
using System;
using System.IO;
using System.Threading.Tasks;

namespace JIRA_NTB_WEB.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ImagesController : ControllerBase
    {
        private readonly IWebHostEnvironment _environment;

        public ImagesController(IWebHostEnvironment environment)
        {
            _environment = environment;
        }

        // API Endpoint: POST api/Images/upload-log
        [HttpPost("upload-log")]
        public async Task<IActionResult> UploadImageLog(IFormFile image)
        {
            // 1. Validate file
            if (image == null || image.Length == 0)
            {
                return BadRequest(new { message = "File ảnh không hợp lệ." });
            }

            try
            {
                // 2. Xác định thư mục lưu trong wwwroot
                // Đường dẫn sẽ là: wwwroot/uploads/auto_logs
                string webRootPath = _environment.WebRootPath;
                string uploadDir = Path.Combine(webRootPath, "uploads", "auto_logs");

                // Tạo thư mục nếu chưa có
                if (!Directory.Exists(uploadDir))
                {
                    Directory.CreateDirectory(uploadDir);
                }

                // 3. Tạo tên file
                string fileName = $"LOG_{DateTime.Now:yyyyMMdd_HHmmss}_{Guid.NewGuid()}.jpg";
                string fullPath = Path.Combine(uploadDir, fileName);

                // 4. Lưu file thực tế xuống ổ cứng server
                using (var stream = new FileStream(fullPath, FileMode.Create))
                {
                    await image.CopyToAsync(stream);
                }

                // 5. Trả về đường dẫn tương đối để Client lưu vào DB
                string relativePath = $"/uploads/auto_logs/{fileName}";

                return Ok(new { url = relativePath });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Lỗi server: " + ex.Message });
            }
        }
    }
}