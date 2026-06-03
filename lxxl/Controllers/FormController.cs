using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using lxxl.Models;
using System.Web.Script.Serialization;
using Newtonsoft.Json;
using System.IO;
using System.Text;
using Base;

namespace lxxl.Controllers
{

    public class FormController : mainBaseController
    {
        //
        // GET: /Form/Index
        public TMLSContext db = new TMLSContext();
        int pagesize = 5;//分页数据每页数量
        string urlcode = "";//返回前台拼接除了页码之外的参数
        public ActionResult Index(int page = 1)
        {
            ViewBag.ItemTypeList = db.T_ItemType.Where(o => !o.IsDelete).ToList();
            int count = db.T_Form.Where(o => !o.IsDelete).Count();
            ViewBag.Count = count / pagesize + ((count % pagesize) == 0 ? 0 : 1);
            return View();
        }

        [HttpPost]
        public ActionResult GetJson(int page = 1)
        {
            //List<T_Form> FormList = db.T_Form.Include("Item.Option").Include("Item.ItemType").OrderByDescending(o => o.CreateTime).Where(o => !o.IsDelete).Skip((page - 1) * pagesize).Take(pagesize).ToList();
            //for (int n = 0; n < FormList.Count; n++)
            //{
            //    FormList[n].Item = FormList[n].Item.Where(s=>!s.IsDelete).OrderBy(o=>o.Order).ToList();
            //    for (int i = 0; i < FormList[n].Item.Count; i++)
            //    {
            //        FormList[n].Item.ToList()[i].Option = FormList[n].Item.ToList()[i].Option.Where(s => !s.IsDelete).OrderBy(o=>o.Order).ToList();
            //    }
            //}

            var FormList1 = db.T_Form.Where(o => !o.IsDelete).OrderByDescending(o => o.CreateTime).Skip((page - 1) * pagesize).Take(pagesize).Select(o => new
            {
                o.ID,
                o.Name,
                Item = db.T_Item.Where(io => io.FormID == o.ID && !io.IsDelete).OrderBy(io => io.Order).Select(io => new
                {
                    io.ID,
                    io.Name,
                    ItemType = db.T_ItemType.Where(it => it.ID == io.ItemTypeID).FirstOrDefault(),
                    Option = db.T_Option.Where(op => op.ItemID == io.ID && !op.IsDelete).Select(op => new
                    {
                        op.ID,
                        op.Name,
                        op.Order,
                        op.IsCustom,
                        op.Custom,
                    })
                })
            }).ToList();
            JsonSerializerSettings setting = new JsonSerializerSettings()
            {
                ReferenceLoopHandling = ReferenceLoopHandling.Ignore
            };
            var ret = JsonConvert.SerializeObject(FormList1, setting);
            return Content(ret);
        }

        [LogFilter]
        public ActionResult AddForm(string Name, string Info, long? ID = null)
        {
            if (ID == null)
            {
                try
                {
                    db.T_Form.Add(new T_Form(Name, Info));
                    db.SaveChanges();
                    return Content("ok:添加成功");
                }
                catch (Exception e)
                {
                    return Content("no:添加失败");
                }
            }
            else
            {
                T_Form Form = db.T_Form.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
                if (Form != null)
                {
                    Form.Name = Name;
                    Form.Info = Info;
                    db.SaveChanges();
                    return Content("ok:保存成功");
                }
                else
                {
                    return Content("no:保存失败");
                }
            }
        }

        [HttpPost]
        [LogFilter]
        public ActionResult AddItem(T_Item Item)
        {
            string id = Request["ID"];
            if (!string.IsNullOrEmpty(id))
            {
                T_Item item = db.T_Item.Where(o => o.ID == Item.ID && !o.IsDelete).FirstOrDefault();
                if (item != null)
                {
                    item.ItemTypeID = Item.ItemTypeID;
                    item.Name = Item.Name;
                    item.Info = Item.Info;
                    item.Order = Item.Order;
                    item.SexType = Item.SexType;
                    db.SaveChanges();
                    return Content("ok:保存成功");
                }
                else
                {
                    return Content("no:保存失败");
                }
            }
            else
            {
                try
                {
                    T_ItemType ItemType = db.T_ItemType.Where(o => o.ID == Item.ItemTypeID).FirstOrDefault();
                    T_Item item = db.T_Item.Add(Item);
                    if (ItemType.IsOne)
                    {
                        db.T_Option.Add(new T_Option(Item.ID, 1, Item.Name + "的默认项"));
                    }
                    db.SaveChanges();
                    return Content("ok:插入成功");
                }
                catch (Exception e)
                {
                    return Content("no:添加选项组失败");
                }
            }

        }

        [HttpPost]
        [LogFilter]
        public ActionResult AddOption(T_Option Option)
        {
            string id = Request["ID"];
            if (!string.IsNullOrEmpty(id))
            {
                T_Option op = db.T_Option.Where(o => o.ID == Option.ID && !o.IsDelete).FirstOrDefault();
                if (op != null)
                {
                    op.Name = Option.Name;
                    op.IsCustom = Option.IsCustom;
                    op.Custom = Option.Custom;
                    op.Order = Option.Order;
                    op.Remark = Option.Remark;
                    op.RecommendPro = Option.RecommendPro;
                    db.SaveChanges();
                    return Content("ok:保存成功");
                }
                else
                {
                    return Content("no:保存失败");
                }
            }
            else
            {
                try
                {
                    db.T_Option.Add(Option);
                    db.SaveChanges();
                    return Content("ok:插入成功");
                }
                catch (Exception e)
                {
                    return Content("no:添加失败");
                }
            }


        }

        [HttpPost]
        [LogFilter]
        public ActionResult DelForm(long ID)
        {
            T_Form Form = db.T_Form.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
            //int usercount = db.T_Action.Where(o => o.FormID == Form.ID && !o.IsDelete).Count();
            //if (usercount > 0)
            //{
            //    return Content("no:有活动或赛事引用该表单，删除失败");
            //}
            if (Form != null)
            {
                Form.IsDelete = true;
                db.SaveChanges();
                return Content("ok:删除表单成功");
            }
            else
            {
                return Content("no:表单不存在，删除失败");
            }
        }

        [HttpPost]
        [LogFilter]
        public ActionResult DelItem(long ID)
        {
            T_Item Item = db.T_Item.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
            if (Item != null)
            {
                Item.IsDelete = true;
                db.SaveChanges();
                return Content("ok:删除表单项成功");
            }
            else
            {
                return Content("no:表单项不存在，删除失败");
            }
        }

        [HttpPost]
        [LogFilter]
        public ActionResult DelOption(long ID)
        {
            T_Option Option = db.T_Option.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
            if (Option != null)
            {
                Option.IsDelete = true;
                db.SaveChanges();
                return Content("ok:删除选项成功");
            }
            else
            {
                return Content("no:选项不存在，删除失败");
            }
        }

        public ActionResult GetForm(long ID)
        {
            T_Form Form = db.T_Form.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
            JsonSerializerSettings setting = new JsonSerializerSettings()
            {
                ReferenceLoopHandling = ReferenceLoopHandling.Ignore
            };
            var ret = JsonConvert.SerializeObject(Form, setting);
            return Content(ret);
        }

        public ActionResult GetItem(long ID)
        {
            T_Item Item = db.T_Item.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
            JsonSerializerSettings setting = new JsonSerializerSettings()
            {
                ReferenceLoopHandling = ReferenceLoopHandling.Ignore
            };
            var ret = JsonConvert.SerializeObject(Item, setting);
            return Content(ret);
        }

        public ActionResult GetOption(long ID)
        {
            T_Option Option = db.T_Option.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
            JsonSerializerSettings setting = new JsonSerializerSettings()
            {
                ReferenceLoopHandling = ReferenceLoopHandling.Ignore
            };
            var ret = JsonConvert.SerializeObject(Option, setting);
            return Content(ret);
        }

        public ActionResult Show(long ID)
        {
            T_Form Form = db.T_Form.Include("Item.Option").Include("Item.ItemType").Where(o => !o.IsDelete && o.ID == ID).FirstOrDefault();
            Form.Item = Form.Item.Where(o => !o.IsDelete).ToList();
            ViewBag.Form = Form;
            return View();
        }

        [LogFilter]
        public ActionResult CopyForm(long ID)
        {
            try
            {
                T_Form Form = db.T_Form.Include("Item.Option").Include("Item.ItemType").Where(o => !o.IsDelete && o.ID == ID).FirstOrDefault();
                Form.Item = Form.Item.Where(o => !o.IsDelete).ToList();
                T_Form NewForm = new T_Form(Form.Name + "-拷贝", Form.Info);
                db.T_Form.Add(NewForm);
                foreach (var item in Form.Item)
                {
                    T_Item Item = new T_Item(NewForm.ID, item.ItemTypeID, item.Name, item.Order);
                    Item.Info = item.Info;
                    db.T_Item.Add(Item);
                    foreach (var option in item.Option)
                    {
                        T_Option Option = new T_Option(Item.ID, option.Order, option.Name, option.IsCustom);
                        Option.Custom = option.Custom;
                        db.T_Option.Add(Option);
                    }
                }
                db.SaveChanges();
                return Content("ok:拷贝成功");
            }
            catch (Exception e)
            {
                return Content("no:拷贝失败");
            }
        }


        #region 异步上传图片
        [HttpPost]
        public ActionResult FileUpload()
        {
            HttpPostedFileBase postfile = Request.Files["fileUp"];//接收文件
            string Name = Request["ImgName"];
            if (postfile == null)
            {
                return Content("no:请选择上传图片!");
            }
            else
            {
                string fileName = Path.GetFileName(postfile.FileName);//获取文件名(文件名.后缀)
                string fileExt = Path.GetExtension(fileName);// 获取文件名后缀
                string[] array = { ".jpg", ".jpeg", ".gif", ".bmp", ".png" };
                Boolean isImg = false;                            //判断文件格式合法性
                foreach (string i in array)
                {
                    if (fileExt == i)
                        isImg = true;
                }
                if (isImg)//判断文件格式合法性
                {
                    string dri = "/Content/UploadFile/" + DateTime.Now.Year + "/" + DateTime.Now.Month + "/" + DateTime.Now.Day + "/";//拼接文件夹路径
                    Directory.CreateDirectory(Path.GetDirectoryName(Request.MapPath(dri)));//创建文件夹
                    string newfileName = Guid.NewGuid().ToString();//新生成文件名
                    string fullDri = dri + newfileName + fileExt;//完整的路径
                    postfile.SaveAs(Request.MapPath(fullDri));//保存文件
                    return Content("ok:" + fullDri);
                }
                return Content("no:文件格式不正确!");
            }
        }
        #endregion

    }
}
