using Microsoft.AspNetCore.Mvc;

namespace JIRA_NTB.Controllers
{
    public class WelcomeController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
