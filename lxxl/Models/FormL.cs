using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace lxxl.Models
{
    public class T_FormL
    {
        public long ID { get; set; }

        public string gId { get; set; }
        public string Name { get; set; }

        public string Info { get; set; }

        public DateTime CreateTime { get; set; }

        public bool IsDelete { get; set; }
        public string Remark { get; set; }

    }
}