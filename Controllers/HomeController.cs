using JIRA_NTB.Models;
using JIRA_NTB.Models.Test;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using System.Diagnostics;

namespace JIRA_NTB.Controllers
{
    public class HomeController : Controller
    {
        private readonly ILogger<HomeController> _logger;

        public HomeController(ILogger<HomeController> logger)
        {
            _logger = logger;
        }

        public IActionResult Index()
        {
            // Đọc file JSON (ví dụ nằm ở wwwroot/data/data.json)
            var jsonPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot/data/data.json");
            var jsonData = System.IO.File.ReadAllText(jsonPath);

            // Deserialize trực tiếp toàn bộ JSON
            var data = JsonConvert.DeserializeObject<RootObject>(jsonData);
            ViewBag.ProjectsJson = JsonConvert.SerializeObject(data!.Projects);

            // Truyền danh sách projects sang view
            return View(data.Projects);
        }

        public IActionResult Privacy()
        {
            return View();
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }
    }
}
