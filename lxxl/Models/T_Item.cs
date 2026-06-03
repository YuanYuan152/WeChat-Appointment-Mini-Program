using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace lxxl.Models
{
    public class T_Item
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long ID { get; set; }

        [Display(Name = "逻辑Id")]
        [StringLength(32)]
        public string gId { get; set; }

        [Display(Name = "所属表单")]
        [ForeignKey("FormID")]
        public T_Form Form { get; set; }
        public long FormID { get; set; }

        [Display(Name = "类型")]
        [ForeignKey("ItemTypeID")]
        public T_ItemType ItemType { get; set; }
        public long ItemTypeID { get; set; }

        [Display(Name="名称")]
        public string Name { get; set; }

        [Display(Name = "排序")]
        public int Order { get; set; }

        [Display(Name = "性别选项")]//0不区分  1仅男性  2仅女性
        public short SexType { get; set; }

        [Display(Name = "是否删除")]
        public bool IsDelete { get; set; }

        [Display(Name = "说明")]
        public string Info { get; set; }

        [Display(Name = "备注")]
        public string Remark { get; set; }
        public ICollection<T_Option> Option { get; set; }

        public T_Item()
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.IsDelete = false;
        }

        public T_Item(long FormgId, long ItemTypegId, string name, int order)
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.IsDelete = false;
            this.FormID = FormgId;
            this.ItemTypeID= ItemTypegId;
            this.Name = name;
            this.Order = order;
        }

    }
}