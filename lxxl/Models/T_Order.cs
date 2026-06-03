using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Web.Mvc;

namespace lxxl.Models
{

    public class T_Order
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long Id { get; set; }

        [Display(Name = "逻辑Id")]
        [StringLength(32)]
        public string gId { get; set; }

        [Display(Name = "用户gId")]
        [StringLength(32)]
        public string usergId { get; set; }

        [Display(Name = "平台gId")]
        [StringLength(32)]
        public string VpgId { get; set; }

        //1、咨询费
        //2、补缴费
        //11、付费阅读费 
        [Display(Name = "订单类型")]
        public short Type { get; set; }

        [Display(Name = "订单来源")]
        [StringLength(32)]
        public string platFormGId { get; set; }

        [Display(Name = "订单状态")]//-2已取消,-1已过期,0未支付，1已支付
        public short State { get; set; }

        [Display(Name = "订单状态doc")]
        public string stateDoc { get; set; }

        [Display(Name = "订单gId")]
        [StringLength(32)]
        public string ordergId { get; set; }

        [Display(Name = "名称")]
        public string Name { get; set; }

        [Display(Name = "联系方式")]
        public string Contact { get; set; }

        [Display(Name = "订单金额")]
        public double Money { get; set; }

        [Display(Name = "优惠金额")]
        public double Discount { get; set; }

        [Display(Name = "优惠方式")]
        public string discountGId { get; set; }

        [Display(Name = "创建时间")]
        public DateTime createTime { get; set; }

        [Display(Name = "超时付费时间")]
        public DateTime overTime { get; set; }

        [Display(Name = "逻辑删除")]
        public bool isDelete { get; set; }

        [Display(Name = "支付信息")]
        public string payInfo { get; set; }

        [Display(Name = "实际使用时间")]
        public DateTime useTime { get; set; }

        [Display(Name = "退款操作员")]
        public string refundAdmin { get; set; }

        [Display(Name = "备注")]
        public string Remark { get; set; }

        public T_Order()
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.createTime = DateTime.Now;
            this.useTime = DateTime.Now;
            this.isDelete = false;
            this.State = 0;
            this.refundAdmin = "";
        }
        public T_Order(string usergId, short type, string name, string ordergId, double money, double Discount, string discountGId = "", short State = 0, string VpgId = "", short VpType = 1)
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.createTime = DateTime.Now;
            this.useTime = this.createTime;
            this.isDelete = false;
            this.State = State;
            this.Type = type;
            this.Name = name;
            this.ordergId = ordergId;
            this.Money = money;
            this.Discount = Discount;
            this.discountGId = discountGId;
            this.usergId = usergId;
            this.VpgId = VpgId;
            this.refundAdmin = "";
        }
        public T_Order(DateTime time, string usergId, short type, string name, string ordergId, double money, double Discount, string discountGId = "", short State = 0, string VpgId = "", short VpType = 1)
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.createTime = time;
            this.useTime = time;
            this.isDelete = false;
            this.State = State;
            this.Type = type;
            this.Name = name;
            this.ordergId = ordergId;
            this.Money = money;
            this.Discount = Discount;
            this.discountGId = discountGId;
            this.usergId = usergId;
            this.VpgId = VpgId;
        }

        public string getOrderTypeDoc()
        {
            switch (this.Type)
            {
                case 1:
                    return "预约咨询";
                case 2:
                    return "付费阅读费";
                case 4:
                    return "活动";               
                default:
                    return "未知业务场景";
            }
        }
    }
}
