using Base;
using lxxl.Models;
using lxxl.Service;
using lxxl.WxService;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace lxxl.Controllers
{
    public class knowledgeController : userBaseController
    {
        public TMLSContext db = new TMLSContext();
        int pagesize = 10;
        //
        // GET: /knowledge/Index

        public ActionResult Index()
        {
            List<T_Content> ContentList = db.T_Content.OrderByDescending(o => o.IsTop).ThenByDescending(o => o.ModifyTime).Where(o => !o.IsDelete && o.Type == 2 ).ToList();
            ViewBag.ContentList = ContentList;
            return View();
        }

        //
        // GET: /knowledge/Detail

        public ActionResult Detail(long ID)
        {
            T_Content Content = db.T_Content.Where(o => o.Type == 2 && o.ID == ID && !o.IsDelete).FirstOrDefault();
            //Content.Views = Content.Views + 1;
            //db.SaveChanges();
            ViewBag.Content = Content;
            return View();
        }

        public ActionResult getDetail(long ID)
        {
            T_Content Content = db.T_Content.Where(o => o.Type == 2 && o.IsShow && o.ID == ID && !o.IsDelete).FirstOrDefault();
            if (Content == null)
            {
                return Json(new { code = -1, msg = "文章不存在" }, JsonRequestBehavior.AllowGet);
            }
            else
            {
                T_User user = Session["User"] as T_User;
                string ContentID = Content.ID.ToString();
                T_Order order = db.T_Order.Where(o => o.Type == 2 && o.usergId == user.gId && !o.isDelete && o.Contact == ContentID).FirstOrDefault();
                if (order == null || order.State!=1)
                {
                    return Json(new { code = -2, msg = "未付款" }, JsonRequestBehavior.AllowGet);
                }
                else
                {
                    Content.Views = Content.Views + 1;
                    db.SaveChanges();
                    return Json(new { code = 0, data = new { User = User }, msg = "获取成功" }, JsonRequestBehavior.AllowGet);
                }
            }
           
        }


        public ActionResult GetQRImg2(long id)
        {
            T_Content Content = db.T_Content.Where(o => o.Type == 2 && o.ID == id && !o.IsDelete).FirstOrDefault();
            if (Content == null)
            {
                return Json(new { code = -1, msg = "文章不存在" }, JsonRequestBehavior.AllowGet);
            }
            if (Content.Money <= 0)
            {
                return Json(new { code = 1, Content = Content, msg = "已付款" }, JsonRequestBehavior.AllowGet);
            }
            T_User user = Session["User"] as T_User;
            if(Content.userID == user.ID)
            {
                return Json(new { code = 1,Content=Content, msg = "已付款" }, JsonRequestBehavior.AllowGet);
            }
            string ContentID = id.ToString();
            T_Order order = db.T_Order.Where(o => o.Type == 11 && o.usergId == user.gId && !o.isDelete && o.platFormGId == ContentID).FirstOrDefault();
            if (order == null)
            {
                order = new T_Order(DateTime.Now, user.gId, 11, "付费阅读费", WeiXinUtil.GenerateOutTradeNo(), Content.Money, 0.0, "", 0, "", 1);
                order.overTime = DateTime.Now.AddYears(1);
                order.platFormGId = ContentID;
                db.T_Order.Add(order);
                T_PayLog payLog = new T_PayLog(order.ordergId, order.Money, 1, 2, user.gId);
                db.T_PayLog.Add(payLog);
                db.SaveChanges();
            }
            else if (order.State == 1)
            {
                Content.Views = Content.Views + 1;
                db.SaveChanges();
                return Json(new { code = 1, Content = Content, msg = "已付款" }, JsonRequestBehavior.AllowGet);
            }
            else
            {
                T_PayLog payLog = db.T_PayLog.Where(o => o.orderGId == order.ordergId && !o.isDelete).FirstOrDefault();
                order.ordergId = WeiXinUtil.GenerateOutTradeNo();
                payLog.orderGId = order.ordergId;
                db.SaveChanges();
            }

            //生成扫码支付模式一url
            WxPayData data = new WxPayData();
            data.SetValue("body", "付费阅读费" + Content.Title);//商品描述
            data.SetValue("attach","test");//附加数据
            data.SetValue("out_trade_no", order.ordergId);//随机字符串
            data.SetValue("total_fee", Convert.ToInt32(order.Money * 100));//总金额
            data.SetValue("time_start", DateTime.Now.ToString("yyyyMMddHHmmss"));//交易起始时间
            data.SetValue("time_expire", DateTime.Now.AddMinutes(10).ToString("yyyyMMddHHmmss"));//交易结束时间
            data.SetValue("goods_tag", "jjj");//商品标记
            data.SetValue("trade_type", "NATIVE");//交易类型
            data.SetValue("product_id", (100 + id).ToString());//商品ID
            WxPayData result = WeiXinUtil.UnifiedOrder(data);//调用统一下单接口
            if (result.GetValue("return_code").ToString()=="SUCCESS")
            {
                string url1 = result.GetValue("code_url").ToString();//获得统一下单接口返回的二维码链接
                //string url1 = Config.domain + "/TenPayV3/smPay/" + order.gId;
                System.Drawing.Bitmap bt;
                ThoughtWorks.QRCode.Codec.QRCodeEncoder qrEncoder = new ThoughtWorks.QRCode.Codec.QRCodeEncoder();
                qrEncoder.QRCodeVersion = 0;
                bt = qrEncoder.Encode(url1);
                MemoryStream ms = new MemoryStream();
                bt.Save(ms, System.Drawing.Imaging.ImageFormat.Jpeg);
                byte[] arr = new byte[ms.Length];
                ms.Position = 0;
                ms.Read(arr, 0, (int)ms.Length);
                ms.Close();

                return Json(new { code = 0, img = Convert.ToBase64String(arr),ordergId = order.ordergId, msg = "付款" }, JsonRequestBehavior.AllowGet);
            }
            return Json(new { code = -2, msg = "获取错误" }, JsonRequestBehavior.AllowGet);
        }
    }
}
