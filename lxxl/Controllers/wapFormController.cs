using Base;
using lxxl.Service;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.Web.Script.Serialization;
using lxxl.Models;

namespace lxxl.Controllers
{
    public class wapFormController : WeBaseController
    {
        //
        // GET: /wapForm/
        public TMLSContext db = new TMLSContext();

        public ActionResult Index()
        {
            return RedirectToAction("wenjuan", new { gId = "98c5cba8c74e44f3b15069a581c72b9a" });
            //Guid TT= Guid.Parse("ECFB8BCD-5AB3-4728-BB5D-77712CEA59F3");
            //var T_Option = db.T_Option.Where(O => O.ItemID == TT);
            //Guid FormID = Guid.Parse("BB1DD4F6-7DF5-4D94-8FA4-E15178D9415A");
            //var Item = db.T_Item.Where(o => o.FormID == FormID && !o.IsDelete && o.ID!= TT);
            //int ii = 1;
            //foreach(T_Option item in T_Option)
            //{
            //    foreach (T_Item opitem in Item)
            //    {
            //        T_Option aaitem = new T_Option(opitem.ID, ii, item.Name);
            //        db.T_Option.Add(aaitem);
            //    }
            //    ii++;
            //}                
            //db.SaveChanges();
            //Guid TT = Guid.Parse("1B8FB4E3-A1D2-4195-AB65-8814A12CD1C0");
            //var T_Option = db.T_Option.Where(O => O.ItemID == TT);
            //Guid FormID = Guid.Parse("ED2E22DC-BA97-494F-AB87-2499159EB38F");
            //var Item = db.T_Item.Where(o => o.FormID == FormID && !o.IsDelete && o.ID != TT);
            //int ii = 1;
            //foreach (T_Option item in T_Option)
            //{
            //    foreach (T_Item opitem in Item)
            //    {
            //        T_Option aaitem = new T_Option(opitem.ID, ii, item.Name);
            //        db.T_Option.Add(aaitem);
            //    }
            //    ii++;
            //}
            //db.SaveChanges();
            //Guid userid = db.T_User.Where(o => o.Type ==1 && !o.IsDelete).FirstOrDefault().ID;
            //if (Session["user"] != null)
            //{
            //    T_User user = Session["user"] as T_User;
            //    T_User user1 = db.T_User.Where(o => o.ID == user.ID && !o.IsDelete).FirstOrDefault();
            //    userid = user1.ID;
            //};
            //JavaScriptSerializer js = new JavaScriptSerializer();
            //var actionLst = db.T_Action.Where(o => !o.IsDelete && o.EndTime > DateTime.Now).OrderByDescending(o => o.StateTime).ToList().Select(o => new
            //{
            //    ID = o.ID,
            //    Name = o.Name,
            //    Info = o.Info,
            //    Img = o.Img,
            //    SignNumber = db.T_SubForm.Count(p => p.ActionID == o.ID && p.UserID == userid)
            //});
            //ViewBag.actionLst = js.Serialize(actionLst);
            return View();

        }

        public ActionResult wenjuan(string gId)
        {
            //Session["patient"] = db.T_User.FirstOrDefault(o => o.ID == 2);
            if (string.IsNullOrEmpty(gId)) { gId = "98c5cba8c74e44f3b15069a581c72b9a"; } 
            T_User patient = Session["patient"] as T_User;
            if (patient == null)
            {
                return Content("请登录");
            };
            //var SubForm = db.T_SubUser.Include("Action").Include("SubFormData").Where(s => s.ActionID == gId && s.UserID == patient.ID).FirstOrDefault();
            var SubForm = db.T_SubUser.Where(s => s.ActionID == gId && s.UserID == patient.ID).FirstOrDefault();
            if (SubForm != null) {
                return View("wenjuanck"); }
            
            return View();
        }

        public ActionResult wenjuanck(string gId)
        {
            //Session["patient"] = db.T_User.FirstOrDefault(o => o.ID == 2);
            if (string.IsNullOrEmpty(gId)) { gId = "98c5cba8c74e44f3b15069a581c72b9a"; }
            T_User patient = Session["patient"] as T_User;
            if (patient == null)
            {
                return Content("请登录");
            };
            //var SubForm = db.T_SubUser.Include("Action").Include("SubFormData").Where(s => s.ActionID == gId && s.UserID == patient.ID).FirstOrDefault();
            //if (SubForm != null)
            //{
            //    T_Form Form = db.T_Form.Include("Item.Option").Include("Item.ItemType").Where(o => o.gId == SubForm.Action.FormID).FirstOrDefault();
            //    ViewBag.SubUser = SubForm;
            //    ViewBag.Form = Form;
            //    return View("wenjuanck");
            //}

            return View();
        }

        public ActionResult ActionInfo(string ID)
        {
            T_User patient = Session["patient"] as T_User;
            var Action = db.T_Action.Where(o => o.ID == ID && !o.IsDelete).FirstOrDefault();
            var Form = db.T_Form.Where(o => o.gId == Action.FormID && !o.IsDelete).Select(o => new
            {
                ID = o.ID,
                Name = o.Name,
                Info = o.Info,
                CreateTime = o.CreateTime,
                Remark = o.Remark,
            }).FirstOrDefault();
            var Item = db.T_Item.Include("Option").Include("ItemType").Where(o => o.FormID == Form.ID && !o.IsDelete).OrderBy(o => o.Order).Select(o => new
            {
                ID = o.ID,
                Name = o.Name,
                Info = o.Info,
                Order = o.Order,
                Remark = o.Remark,
                FormID = o.FormID,
                ItemTypeID = o.ItemTypeID,
                ItemType = o.ItemType,
                Option = o.Option.Where(op => !op.IsDelete).OrderBy(op => op.Order),
            }).ToList();           
            return Json(new { code = 1, data = new { Action = Action, Form = Form, Item= Item }, msg = "获取成功" }, JsonRequestBehavior.AllowGet);
        }        

        long[] OptionIDs = {34,35,36,37,38,39,40};
        //提交结果
        [HttpPost]
        public JsonResult Submit(string jsonText = "")
        {
            Log.Debug("Submit", jsonText);
            string time = DateTime.Now.ToString("yyyy/MM/dd HH:mm:ss");//获取当前系统时间
            try
            {
                JArray question = (JArray)JsonConvert.DeserializeObject(jsonText);
                string actionid = question[0]["id"].ToString();
                var Action = db.T_Action.Where(o => o.ID == actionid && !o.IsDelete).FirstOrDefault();
                if (Action == null)
                { return Json(new { code = -1, msg = "提交失败,找不到活动" }, JsonRequestBehavior.AllowGet); }
                else if (Action.StateTime > DateTime.Now)
                { return Json(new { code = -1, msg = "提交失败,活动未开始" }, JsonRequestBehavior.AllowGet); }
                else if (Action.EndTime < DateTime.Now)
                { return Json(new { code = -1, msg = "提交失败,活动已结束" }, JsonRequestBehavior.AllowGet); }
                T_User patient = Session["patient"] as T_User;
                T_SubUser subform = db.T_SubUser.Where(o => o.UserID == patient.ID && o.ActionID == Action.ID).FirstOrDefault();
                if (subform != null)
                {
                    //return Json(new { code = -1, msg = "请勿重复提交！" }, JsonRequestBehavior.AllowGet);
                    subform.SubTime = DateTime.Now;
                    for (int n = 0; n < question.Count; n++)
                    {

                        string item = question[n]["item"].ToString();
                        JArray option = (JArray)JsonConvert.DeserializeObject(item);
                        for (int j = 0; j < option.Count; j++)
                        {
                            long value =  long.Parse(option[j]["value"].ToString());
                            string content = option[j]["content"].ToString();
                            var bSubFormData = db.T_SubUserData.Where(o => o.SubUserID == subform.ID && o.OptionID == value).FirstOrDefault();
                            if (bSubFormData != null)
                            {
                                bSubFormData.Content = content;
                            }
                            else
                            {
                                db.T_SubUserData.Add(new T_SubUserData(subform.ID, value, content, ""));
                            }
                        }
                    }
                    db.SaveChanges();

                    UpdateRecord(patient.ID, question);
                    return Json(new { code = 1, data = new { ID = 1 }, msg = "提交成功,感谢您的参与" }, JsonRequestBehavior.AllowGet);
                }
                subform = new T_SubUser(actionid, patient.ID);
                db.T_SubUser.Add(subform);
                db.SaveChanges();
                for (int n = 0; n < question.Count; n++)
                {

                    string item = question[n]["item"].ToString();
                    JArray option = (JArray)JsonConvert.DeserializeObject(item);
                    for (int j = 0; j < option.Count; j++)
                    {
                        long value = long.Parse(option[j]["value"].ToString());
                        string content = option[j]["content"].ToString();
                        db.T_SubUserData.Add(new T_SubUserData(subform.ID, value, content, ""));
                    }
                }
                db.SaveChanges();
                UpdateRecord(patient.ID, question);
              
                return Json(new { code = 1, data = new { ID = 1 }, msg = "提交成功,感谢您的参与" }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.ToString() }, JsonRequestBehavior.AllowGet);
            }
            return Json(new { code = -1, msg = "提交失败,请规范填写" }, JsonRequestBehavior.AllowGet);
        }

        public void UpdateRecord(long patientID, JArray question)
        {
            List<T_ConsultationRecord> ConsultationRecords = db.T_ConsultationRecord.Where(o => o.UserID == patientID && !o.IsDelete && o.record == "").ToList();
            if (ConsultationRecords.Count >= 1)
            {
                string content = "";
                string name = "";
                for (int n = 0; n < question.Count; n++)
                {
                    string item = question[n]["item"].ToString();
                    JArray option = (JArray)JsonConvert.DeserializeObject(item);
                    for (int j = 0; j < option.Count; j++)
                    {
                        long value = long.Parse(option[j]["value"].ToString());
                        if (OptionIDs.Contains(value))
                        {
                            name += db.T_Option.FirstOrDefault(o => o.ID == value).Name + "；";
                            content = option[j]["content"].ToString();
                        }
                    }
                }
                foreach (T_ConsultationRecord item in ConsultationRecords)
                {
                    item.record = name + content;
                }
                db.SaveChanges();
            }
        }
        
        public ActionResult SubmitInfo(string ID)
        {
            T_User patient = Session["patient"] as T_User;
            if (patient == null)
            {
            };
            var Action = db.T_Action.Where(o => o.ID == ID && !o.IsDelete).Select(o => new
            {
                ID = o.ID,
                Name = o.Name,
                FormID = o.FormID
            }).FirstOrDefault();
            var Form = db.T_Form.Where(o => o.gId == Action.FormID && !o.IsDelete).Select(o => new
            {
                ID = o.ID,
                Name = o.Name,
                Info = o.Info,
                CreateTime = o.CreateTime,
                Remark = o.Remark,
            }).FirstOrDefault();
            var SubForm = db.T_SubUser.Where(s => s.ActionID == ID && s.UserID == patient.ID).FirstOrDefault();
            var SubFormData = db.T_SubUserData.Where(o => o.SubUserID == SubForm.ID).Select(sf => new { SubFormID = sf.SubUserID, OptionID = sf.OptionID, Content = sf.Content }).ToList();
            var Item = db.T_Item.Include("Option").Include("ItemType").Where(o => o.FormID == Form.ID && !o.IsDelete).OrderBy(o => o.Order).Select(o => new
            {
                ID = o.ID,
                Name = o.Name,
                Info = o.Info,
                Order = o.Order,
                Remark = o.Remark,
                FormID = o.FormID,
                ItemTypeID = o.ItemTypeID,
                ItemType = o.ItemType,
                Option = o.Option.Where(op => !op.IsDelete).OrderBy(op => op.Order),
            }).ToList();
            JsonSerializerSettings setting = new JsonSerializerSettings()
            {
                ReferenceLoopHandling = ReferenceLoopHandling.Ignore
            };
            var ret = JsonConvert.SerializeObject(SubForm, setting);
            return Json(new { code = 1, data = new { Action = Action, Form = Form, Item = Item, SubForm = SubFormData }, msg = "获取成功" }, JsonRequestBehavior.AllowGet);
        }


        // /wapForm/register
        public ActionResult register()
        {
            T_User patient = Session["patient"] as T_User;// db.T_User.FirstOrDefault(o => o.ID == 1);  

            T_RegistrationForm RegistrationForm = db.T_RegistrationForm.FirstOrDefault(o => o.UserID == patient.ID);
            if (RegistrationForm == null)
            {
                RegistrationForm = new T_RegistrationForm(patient.ID);
                RegistrationForm.subject = "";
                RegistrationForm.recentEvents = "";
            }

            ViewBag.RegistrationForm = RegistrationForm;

            var Fieldlist = db.T_Field.Where(o => !o.IsDelete).ToList();
            ViewBag.Fieldlist = Fieldlist;

            return View();
        }

        //更新
        [HttpPost]
        public ActionResult postRegister(T_RegistrationForm registrationForm)
        {
            try
            {
                T_RegistrationForm updateRegistrationForm = db.T_RegistrationForm.FirstOrDefault(o => o.gId == registrationForm.gId);
                if (updateRegistrationForm == null)
                {
                    T_User patient = Session["patient"] as T_User;// db.T_User.FirstOrDefault(o => o.ID == 1);
                    registrationForm.UserID = patient.ID;
                    db.T_RegistrationForm.Add(registrationForm);
                }
                else
                {
                    updateRegistrationForm.name = registrationForm.name;
                    updateRegistrationForm.gender = registrationForm.gender;
                    updateRegistrationForm.age = registrationForm.age;
                    updateRegistrationForm.nation = registrationForm.nation;
                    updateRegistrationForm.mobile = registrationForm.mobile;
                    updateRegistrationForm.wechat = registrationForm.wechat;
                    updateRegistrationForm.isSelf = registrationForm.isSelf;
                    updateRegistrationForm.relationship = registrationForm.relationship;
                    updateRegistrationForm.career = registrationForm.career;
                    updateRegistrationForm.maritalStatus = registrationForm.maritalStatus;
                    updateRegistrationForm.educationalLevel = registrationForm.educationalLevel;
                    updateRegistrationForm.religion = registrationForm.religion;
                    updateRegistrationForm.city = registrationForm.city;
                    updateRegistrationForm.cohabit = registrationForm.cohabit;
                    updateRegistrationForm.gateway = registrationForm.gateway;
                    updateRegistrationForm.subject = registrationForm.subject;
                    updateRegistrationForm.diagnosis = registrationForm.diagnosis;
                    updateRegistrationForm.takeMedicine = registrationForm.takeMedicine;
                    updateRegistrationForm.troubledTime = registrationForm.troubledTime;
                    updateRegistrationForm.recentEvents = registrationForm.recentEvents;
                    updateRegistrationForm.experience = registrationForm.experience;
                    updateRegistrationForm.emotionalState = registrationForm.emotionalState;
                    updateRegistrationForm.acOfWill = registrationForm.acOfWill;
                    updateRegistrationForm.manifestations = registrationForm.manifestations;
                    updateRegistrationForm.urgency = registrationForm.urgency;
                    updateRegistrationForm.urgency1 = string.IsNullOrEmpty(registrationForm.urgency1) ? "" : registrationForm.urgency1;
                    updateRegistrationForm.urgency2 = string.IsNullOrEmpty(registrationForm.urgency2) ? "" : registrationForm.urgency2;
                    updateRegistrationForm.Item25 = registrationForm.Item25;
                    updateRegistrationForm.Item26 = registrationForm.Item26;
                    updateRegistrationForm.serviceForm = registrationForm.serviceForm;
                    updateRegistrationForm.feeRange = registrationForm.feeRange;
                    updateRegistrationForm.otherMsg = registrationForm.otherMsg;
                    updateRegistrationForm.telephoning = registrationForm.telephoning;
                    updateRegistrationForm.ModifyTime = DateTime.Now;
                }

                db.SaveChanges();
                return Json(new { code = 0, msg = "提交成功。" });
            }
            catch (Exception ex)
            {
                return Json(new { code = -1, msg = ex.Message });
            }
        }

    }
}
