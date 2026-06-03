using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using lxxl.Models;
using System.IO;
using System.Drawing;
using Base;

namespace lxxl.Controllers
{
    public class ActionController : mainBaseController
    {
        //
        // GET: /Action/
        public TMLSContext db = new TMLSContext();
        int pagesize = 10;
        public ActionResult Index(int page = 1)
        {
            List<T_Action> ActionList = db.T_Action.Include("SubUser").OrderByDescending(o => o.CreateTime).Where(o => !o.IsDelete).Skip((page - 1) * pagesize).Take(pagesize).ToList();
            ViewBag.ActionList = ActionList;
            ViewBag.ThisPage = page;
            ViewBag.Count = db.T_Action.OrderBy(o => o.CreateTime).Where(o => !o.IsDelete).Count();
            return View();
        }

        public ActionResult AddAction()
        {
            List<T_FormL> FormList = db.T_Form.Where(o => !o.IsDelete).Select(o => new T_FormL
            {
                ID = o.ID,
                Name = o.Name,
                gId = o.gId
            }).ToList();
            ViewBag.FormList = FormList;
            return View();
        }

        public ActionResult EditAction(string ID)
        {
            T_Action Action = db.T_Action.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
            List<T_FormL> FormList = db.T_Form.Where(o => !o.IsDelete).Select(o => new T_FormL
            {
                ID=o.ID,
                Name=o.Name,
                gId=o.gId
            }).ToList();
            ViewBag.FormList = FormList;
            ViewBag.Action = Action;
            return View("AddAction");
        }

        [HttpPost]
        public ActionResult SaveAction(T_Action model)
        {
            T_Action Action = db.T_Action.Where(o => o.ID == model.ID).FirstOrDefault();
            List<T_FormL> FormList = db.T_Form.Where(o => !o.IsDelete).Select(o => new T_FormL
            {
                ID = o.ID,
                Name = o.Name,
                gId = o.gId
            }).ToList();
            ViewBag.FormList = FormList;
            HttpPostedFileBase postfile = Request.Files["fileimg"];//接收文件
            if (Action == null && string.IsNullOrEmpty(postfile.FileName))
            {
                Session["alert"] = "请选择上传文件";
                ViewBag.Action = Action;
                return View("AddAction");
            }
            else if (!string.IsNullOrEmpty(postfile.FileName))
            {
                string upfile = UpdateFile(postfile);
                if (upfile.Split(':')[0] == "ok")
                {
                    model.Img = upfile.Split(':')[1];
                }
                else
                {
                    Session["alert"] = upfile.Split(':')[1];
                    ViewBag.Action = Action;
                    return View("AddAction");
                }
            }
            else
            {
                model.Img = Action.Img;
            }
            if (string.IsNullOrEmpty(model.Name))
            {
                Session["alert"] = "请输入活动名称";
            }
            else if (string.IsNullOrEmpty(model.FormID.ToString()))
            {
                Session["alert"] = "请选择活动报名表单";
            }
            else
            {
                if (Action == null)//新增
                {
                    try
                    {
                        T_Action action = new T_Action(model.Name, model.Info, model.FormID);
                        action.Content = model.Content;
                        action.CompanyName = model.CompanyName;
                        action.ContactName = model.ContactName;
                        action.Tel = model.Tel;
                        action.Place = model.Place;
                        action.StateTime = model.StateTime;
                        action.EndTime = model.EndTime;
                        action.StateSignTime = model.StateTime;
                        action.EndSignTime = model.EndTime;
                        action.Number = model.Number;
                        action.Img = model.Img;
                        db.T_Action.Add(action);
                        db.SaveChanges();
                        string path = System.Web.HttpContext.Current.Server.MapPath("~/QRCodePic");
                        path = path + "/" + action.ID + ".png";
                        if (!System.IO.File.Exists(path))
                        {
                            Bitmap bimg = null;
                            bimg = Service.mydes.CreateQRCode("https://www.ji-psy.com/wapForm/wenjuan?gId=" + action.ID);
                            Service.mydes.SaveQRCode(bimg, path);
                        }
                        Session["alert"] = "新增成功";
                    }
                    catch (Exception e)
                    {
                        Session["alert"] = "新增失败";
                    }
                }
                else//编辑
                {
                    try
                    {
                        Action.Name = model.Name;
                        Action.FormID = model.FormID;
                        Action.Info = model.Info;
                        Action.Content = model.Content;
                        Action.CompanyName = model.CompanyName;
                        Action.ContactName = model.ContactName;
                        Action.Tel = model.Tel;
                        Action.Place = model.Place;
                        Action.StateTime = model.StateTime;
                        Action.EndTime = model.EndTime;
                        Action.StateSignTime = model.StateTime;
                        Action.EndSignTime = model.EndTime;
                        Action.Number = model.Number;
                        Action.Img = model.Img;
                        db.SaveChanges();
                        Session["alert"] = "保存成功";
                    }
                    catch (Exception e)
                    {
                        Session["alert"] = "保存失败";
                    }
                }
                return RedirectToAction("Index", "Action");
            }
            ViewBag.Action = model;
            return View("AddAction");
        }

        public ActionResult DelAction(string ID)
        {
            T_Action Action = db.T_Action.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
            if (Action != null)
            {
                Action.IsDelete = false;
                db.SaveChanges();
                Session["alert"] = "删除活动成功";
            }
            else
            {
                Session["alert"] = "该活动不存在";
            }
            return RedirectToAction("Index", "Action");
        }

        public ActionResult ActionSign(string ID)
        {
            T_Action Action = db.T_Action.Where(o => !o.IsDelete && o.ID == ID).FirstOrDefault();
            List<T_SubUser> SubFormList = db.T_SubUser.Include("User").Where(o => o.ActionID == ID).ToList();
            ViewBag.SubFormList = SubFormList;
            return View();
        }

        public ActionResult Sign(long ID)
        {
            T_SubUser SubUser = db.T_SubUser.Include("User").Where(o => o.ID == ID).FirstOrDefault();
            T_Action Action = db.T_Action.Where(o => !o.IsDelete && o.ID == SubUser.ActionID).FirstOrDefault();
            T_Form Form = db.T_Form.Include("Item.Option").Include("Item.ItemType").Where(o => o.gId == Action.FormID).FirstOrDefault();
            ViewBag.SubUser = SubUser;
            ViewBag.Form = Form;
            ViewBag.Action = Action;
            T_User patient = db.T_User.FirstOrDefault(o => o.ID == SubUser.UserID);
            ViewBag.patient = patient;
            List<T_SubUserData> SubFormDataList = db.T_SubUserData.Where(o => o.SubUserID == SubUser.ID).ToList();
            ViewBag.SubFormDataList = SubFormDataList;
            return View();
        }


        #region 上传文件
        public string UpdateFile(HttpPostedFileBase postfile)
        {
            string Name = Request["ImgName"];
            if (postfile == null)
            {
                return "no:请选择上传文件!";
            }
            else
            {
                string fileName = Path.GetFileName(postfile.FileName);//获取文件名(文件名.后缀)
                string fileExt = Path.GetExtension(fileName);// 获取文件名后缀
                string[] array = { ".jpg", ".jpeg", ".gif", ".bmp", ".png", "doc" };
                Boolean isImg = true;                            //判断文件格式合法性
                foreach (string i in array)
                {
                    if (fileExt == i)
                        isImg = true;
                }
                if (isImg)//判断文件格式合法性
                {
                    string dri = "/Content/Action/";//拼接文件夹路径
                    Directory.CreateDirectory(Path.GetDirectoryName(Request.MapPath(dri)));//创建文件夹
                    string newfileName = Guid.NewGuid().ToString();//新生成文件名
                    string fullDri = dri + newfileName + fileExt;//完整的路径
                    postfile.SaveAs(Request.MapPath(fullDri));//保存文件
                    return "ok:" + fullDri;
                }
                else
                {
                    return "no:上传文件失败";
                }
            }
        }
        #endregion
    }
}
