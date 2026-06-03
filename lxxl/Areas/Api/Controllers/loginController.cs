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
    public class loginController : Controller
    {
        private TMLSContext db = new TMLSContext();

        // GET: /Api/login/
        public ActionResult Index()
        {
            return View();
        }

        // POST: /Api/login/Login
        [HttpPost]
        public JsonResult Login(string phone, string code)
        {
            try
            {
                // 验证验证码（这里简化处理，实际应该验证短信验证码） || code != "123456"
                if (string.IsNullOrEmpty(code)) // 临时使用固定验证码123456
                {
                    return Json(new { success = false, message = "验证码错误" });
                }

                // 检查用户是否存在
                var user = GetUserByPhone(phone);
                if (user == null)
                {
                    return Json(new { success = false, message = "用户不存在，请先注册" });
                }

                // 生成JWT Token
                var token = GenerateJWTToken(user);

                return Json(new { 
                    success = true, 
                    message = "登录成功",
                    data = new { 
                        token = token,
                        user = user
                    }
                });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = "登录失败：" + ex.Message });
            }
        }

        // POST: /Api/login/Register
        [HttpPost]
        public JsonResult Register(string phone, string code, string password)
        {
            try
            {
                // 验证验证码（这里简化处理，实际应该验证短信验证码）
                if (string.IsNullOrEmpty(code) || code != "123456") // 临时使用固定验证码123456
                {
                    return Json(new { success = false, message = "验证码错误" });
                }

                // 检查用户是否已存在
                if (GetUserByPhone(phone) != null)
                {
                    return Json(new { success = false, message = "用户已存在" });
                }

                // 创建新用户
                var userId = CreateUser(phone, password);
                if (userId > 0)
                {
                    return Json(new { success = true, message = "注册成功" });
                }
                else
                {
                    return Json(new { success = false, message = "注册失败" });
                }
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = "注册失败：" + ex.Message });
            }
        }

        // POST: /Api/login/SendVerificationCode
        [HttpPost]
        public JsonResult SendVerificationCode(string phone)
        {
            try
            {
                // 这里应该调用短信服务发送验证码
                // 暂时返回成功，前端可以使用固定验证码123456
                return Json(new { success = true, message = "验证码已发送，请使用123456" });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = "发送失败：" + ex.Message });
            }
        }

        // POST: /Api/login/Logout
        [HttpPost]
        public JsonResult Logout()
        {
            try
            {
                // 这里可以添加token黑名单逻辑
                return Json(new { success = true, message = "退出成功" });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = "退出失败：" + ex.Message });
            }
        }

        private dynamic GetUserByPhone(string phone)
        {
            var user = db.T_User.FirstOrDefault(u => u.UserName == phone);
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

        private int CreateUser(string phone, string password)
        {
            try
            {
                var user = new T_User(phone, HashPassword(password), phone, 0)
                {
                    UserName = phone,
                    PassWord = HashPassword(password),
                    CreateTime = DateTime.Now,
                    Status = 0
                };

                db.T_User.Add(user);
                db.SaveChanges();
                return (int)user.ID;
            }
            catch
            {
                return 0;
            }
        }

        private string HashPassword(string password)
        {
            // 简单的密码哈希，实际项目中应使用更安全的方法
            return Convert.ToBase64String(Encoding.UTF8.GetBytes(password));
        }

        private string GenerateJWTToken(dynamic user)
        {
            // 简单的token生成，实际项目中应使用JWT库
            var tokenData = $"{user.Id}_{user.Phone}_{DateTime.UtcNow.Ticks}";
            return Convert.ToBase64String(Encoding.UTF8.GetBytes(tokenData));
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
}
