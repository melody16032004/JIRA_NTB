using Microsoft.AspNetCore.Mvc;

namespace JIRA_NTB.Controllers
{
    public class TaskController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
