using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.Text;
using Newtonsoft.Json;
using lxxl.Models;

namespace lxxl.Areas.Api.Controllers
{
    [AuthorizeUser] // 自定义授权过滤器
    public class userCenterController : Controller
    {
        private TMLSContext db = new TMLSContext();

        // GET: /Api/userCenter/
        public ActionResult Index()
        {
            return View();
        }

        // GET: /Api/userCenter/GetUserInfo
        [HttpGet]
        public JsonResult GetUserInfo()
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId <= 0)
                {
                    return Json(new { success = false, message = "未授权访问" });
                }

                var userInfo = GetUserById(userId);
                if (userInfo != null)
                {
                    return Json(new { 
                        success = true, 
                        message = "获取成功",
                        data = userInfo
                    });
                }
                else
                {
                    return Json(new { success = false, message = "用户信息不存在" });
                }
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = "获取用户信息失败：" + ex.Message });
            }
        }

        // POST: /Api/userCenter/UpdateUserInfo
        [HttpPost]
        public JsonResult UpdateUserInfo(string name, string phone, string email, string gender, int age)
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId <= 0)
                {
                    return Json(new { success = false, message = "未授权访问" });
                }

                var success = UpdateUser(userId, name, phone, email, gender, age);
                if (success)
                {
                    return Json(new { success = true, message = "更新成功" });
                }
                else
                {
                    return Json(new { success = false, message = "更新失败" });
                }
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = "更新失败：" + ex.Message });
            }
        }

        // GET: /Api/userCenter/GetOrders
        [HttpGet]
        public JsonResult GetOrders()
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId <= 0)
                {
                    return Json(new { success = false, message = "未授权访问" });
                }

                var orders = GetUserOrders(userId);
                return Json(new { 
                    success = true, 
                    message = "获取成功",
                    data = orders
                });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = "获取订单失败：" + ex.Message });
            }
        }

        // GET: /Api/userCenter/GetConsultations
        [HttpGet]
        public JsonResult GetConsultations()
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId <= 0)
                {
                    return Json(new { success = false, message = "未授权访问" });
                }

                var consultations = GetUserConsultations(userId);
                return Json(new { 
                    success = true, 
                    message = "获取成功",
                    data = consultations
                });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = "获取咨询记录失败：" + ex.Message });
            }
        }

        // GET: /Api/userCenter/GetConsultants
        [HttpGet]
        public JsonResult GetConsultants()
        {
            try
            {
                var consultants = GetAllConsultants();
                return Json(new { 
                    success = true, 
                    message = "获取成功",
                    data = consultants
                });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = "获取咨询师失败：" + ex.Message });
            }
        }

        // GET: /Api/userCenter/GetForms
        [HttpGet]
        public JsonResult GetForms()
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId <= 0)
                {
                    return Json(new { success = false, message = "未授权访问" });
                }

                var forms = GetUserForms(userId);
                return Json(new { 
                    success = true, 
                    message = "获取成功",
                    data = forms
                });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = "获取登记表失败：" + ex.Message });
            }
        }

        // GET: /Api/userCenter/GetNotifications
        [HttpGet]
        public JsonResult GetNotifications()
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId <= 0)
                {
                    return Json(new { success = false, message = "未授权访问" });
                }

                var notifications = GetUserNotifications(userId);
                return Json(new { 
                    success = true, 
                    message = "获取成功",
                    data = notifications
                });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = "获取通知失败：" + ex.Message });
            }
        }

        private int GetCurrentUserId()
        {
            // 从请求头中获取token并解析用户ID
            var token = Request.Headers["Authorization"]?.Replace("Bearer ", "");
            if (string.IsNullOrEmpty(token))
            {
                return 0;
            }

            try
            {
                var tokenData = Encoding.UTF8.GetString(Convert.FromBase64String(token));
                var parts = tokenData.Split('_');
                if (parts.Length >= 2)
                {
                    return Convert.ToInt32(parts[0]);
                }
            }
            catch
            {
                return 0;
            }

            return 0;
        }

        private dynamic GetUserById(int userId)
        {
            var user = db.T_User.FirstOrDefault(u => u.ID == userId);
            if (user != null)
            {
                return new
                {
                    Id = user.ID,
                    Name = user.Name ?? "",
                    Phone = user.UserName,
                    Email = user.Mail ?? "",
                    Gender = user.Sex ?? "male",
                    Age = user.Age,
                    Avatar = user.TopUrl ?? ""
                };
            }
            return null;
        }

        private bool UpdateUser(int userId, string name, string phone, string email, string gender, int age)
        {
            try
            {
                var user = db.T_User.FirstOrDefault(u => u.ID == userId);
                if (user != null)
                {
                    user.Name = name ?? "";
                    user.UserName = phone ?? "";
                    user.Mail = email ?? "";
                    user.Sex = gender ?? "male";
                    user.Age = age;
                    user.ModifyTime = DateTime.Now;

                    db.SaveChanges();
                    return true;
                }
                return false;
            }
            catch
            {
                return false;
            }
        }

        private List<dynamic> GetUserOrders(int userId)
        {
            return db.T_Order
                .Where(o => o.usergId == userId.ToString())
                .OrderByDescending(o => o.createTime)
                .Select(o => (dynamic)new
                {
                    Id = o.Id,
                    OrderNo = o.ordergId ?? "",
                    ServiceName = o.Name ?? "",
                    Amount = o.Money,
                    Status = o.stateDoc ?? "",
                    CreateTime = o.createTime
                })
                .ToList();
        }

        private List<dynamic> GetUserConsultations(int userId)
        {
            return db.T_Consultation
                .Where(c => c.UserID == userId)
                .OrderByDescending(c => c.createTime)
                .Select(c => (dynamic)new
                {
                    Id = c.ID,
                    ConsultantName = c.name ?? "",
                    ServiceType = c.type.ToString(),
                    ConsultationTime = c.SureTime,
                    Status = c.State.ToString(),
                    CreateTime = c.createTime
                })
                .ToList();
        }

        private List<dynamic> GetAllConsultants()
        {
            return db.T_Doctor
                .Where(d => d.IsShow)
                .OrderByDescending(d => d.ID)
                .Select(d => (dynamic)new
                {
                    Id = d.ID,
                    Name = d.name ?? "",
                    Title = d.position ?? "",
                    Specialty = d.introduce ?? "",
                    Avatar = d.topUrl ?? "",
                    Rating = 5.0
                })
                .ToList();
        }

        private List<dynamic> GetUserForms(int userId)
        {
            return db.T_RegistrationForm
                .Where(f => f.UserID == userId)
                .OrderByDescending(f => f.CreateTime)
                .Select(f => (dynamic)new
                {
                    Id = f.ID,
                    FormName = f.name ?? "",
                    FormType = f.subject ?? "",
                    Status = f.IsTop ? "已处理" : "未处理",
                    SubmitTime = f.CreateTime
                })
                .ToList();
        }

        private List<dynamic> GetUserNotifications(int userId)
        {
            // 暂时返回空列表，因为没有通知表
            return new List<dynamic>();
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                db.Dispose();
            }
            base.Dispose(disposing);
        }
    }

    // 自定义授权过滤器
    public class AuthorizeUserAttribute : FilterAttribute, IAuthorizationFilter
    {
        public void OnAuthorization(AuthorizationContext filterContext)
        {
            var token = filterContext.HttpContext.Request.Headers["Authorization"]?.Replace("Bearer ", "");
            if (string.IsNullOrEmpty(token))
            {
                filterContext.Result = new HttpUnauthorizedResult();
                return;
            }

            // 验证token有效性
            if (!IsValidToken(token))
            {
                filterContext.Result = new HttpUnauthorizedResult();
                return;
            }
        }

        private bool IsValidToken(string token)
        {
            try
            {
                var tokenData = Encoding.UTF8.GetString(Convert.FromBase64String(token));
                var parts = tokenData.Split('_');
                if (parts.Length >= 3)
                {
                    var timestamp = Convert.ToInt64(parts[2]);
                    var tokenTime = new DateTime(timestamp);
                    // 检查token是否过期（24小时）
                    return DateTime.UtcNow.Subtract(tokenTime).TotalHours < 24;
                }
            }
            catch
            {
                return false;
            }
            return false;
        }
    }
}
