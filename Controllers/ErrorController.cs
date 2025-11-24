using Microsoft.AspNetCore.Mvc;

namespace JIRA_NTB.Controllers
{
    public class ErrorController : Controller
    {
        [Route("Error/{statusCode}")]
        public IActionResult HttpStatusCodeHandler(int statusCode)
        {
            switch (statusCode)
            {
                case 404:
                    ViewData["Title"] = "404 - Không tìm thấy";
                    return View("NotFound404"); // Trả về View NotFound404.cshtml

                case 403:
                    ViewData["Title"] = "403 - Từ chối Truy cập";
                    return View("Forbidden403");

                case 504:
                    ViewData["Title"] = "504 - Hết thời gian chờ";
                    return View("Timeout504");
                case 500:
                    ViewData["Title"] = "500 - Lỗi máy chủ nội bộ";
                    return View("ServerError500");
            }

            // Xử lý các lỗi khác nếu muốn
            return View("Error"); // Một trang lỗi chung
        }
    }
}
