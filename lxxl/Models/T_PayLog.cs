using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Web.Mvc;

namespace lxxl.Models
{

    public class T_PayLog
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long Id { get; set; }

        [Display(Name = "逻辑Id")]
        [StringLength(32)]
        public string gId { get; set; }

        [Display(Name = "订单gid")]
        [StringLength(32)]
        public string orderGId { get; set; }

        [Display(Name = "金额")]
        public double Money { get; set; }

        [Display(Name = "退款金额")]
        public double refundMoney { get; set; }

        [Display(Name = "支付方式")]//-1.后台支付 1.微信支付 2.支付宝支付 3.余额支付 5.线下现金
        public short payType { get; set; }

        [Display(Name = "支付场景")]//与支付回调对应
        public short Scene { get; set; }

        [Display(Name = "状态")]//0.未付款 1.已付款 2.已退款
        public short State { get; set; }

        [Display(Name = "创建时间")]
        public DateTime createTime { get; set; }

        [Display(Name = "支付时间")]
        public DateTime? payTime { get; set; }

        [Display(Name = "逻辑删除")]
        public bool isDelete { get; set; }

        [Display(Name = "备注")]
        public string payInfo { get; set; }

        [Display(Name = "支付账号")]
        public string Account { get; set; }

        public T_PayLog()
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.createTime = DateTime.Now;
            this.isDelete = false;
            this.State = 0;
            this.payType = 0;
            this.refundMoney = 0;
        }
        public T_PayLog(string orderGId, double Money, short Scene, short payType, string Account)
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.createTime = DateTime.Now;
            this.isDelete = false;
            this.State = 0;
            this.orderGId = orderGId;
            this.Money = Money;
            this.Scene = Scene;
            this.payType = payType;
            this.Account = Account;
            this.refundMoney = 0;
        }

        public string getPayTypeDoc()
        {
            switch (this.payType)
            {//-1.后台支付 1.微信支付 2.支付宝支付 3.余额支付 4.线下现金
                case -1:
                    return "后台发放";
                case 1:
                    return "线上微信";
                case 2:
                    return "线上支付宝";
                case 3:
                    return "会员卡支付";
                case 4:
                    return "现金支付";                
                default:
                    return "未知支付方式";
            }
        }
    }
}
