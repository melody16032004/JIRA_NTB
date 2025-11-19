using Microsoft.AspNetCore.Mvc;

namespace JIRA_NTB.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CheckInController : ControllerBase
    {
        private readonly IWebHostEnvironment _environment;

        public CheckInController(IWebHostEnvironment environment)
        {
            _environment = environment;
        }

        [HttpPost("upload")]
        public async Task<IActionResult> UploadImage(IFormFile image)
        {
            if (image == null || image.Length == 0)
                return BadRequest("Không có ảnh được tải lên.");

            try
            {
                // 1. Tạo đường dẫn lưu file: wwwroot/uploads/checkin/
                string uploadsFolder = Path.Combine(_environment.WebRootPath, "uploads", "checkin");

                if (!Directory.Exists(uploadsFolder))
                    Directory.CreateDirectory(uploadsFolder);

                // 2. Tạo tên file duy nhất
                string uniqueFileName = $"{DateTime.Now:yyyyMMdd_HHmmss}_{Guid.NewGuid()}.jpg";
                string filePath = Path.Combine(uploadsFolder, uniqueFileName);

                // 3. Lưu file vào ổ đĩa server
                using (var fileStream = new FileStream(filePath, FileMode.Create))
                {
                    await image.CopyToAsync(fileStream);
                }

                // 4. Trả về đường dẫn tương đối để WPF lưu vào DB
                // Kết quả ví dụ: "/uploads/checkin/20251119_123456_guid.jpg"
                string relativePath = $"/uploads/checkin/{uniqueFileName}";

                return Ok(new { path = relativePath });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Lỗi server: {ex.Message}");
            }
        }
    }
}
