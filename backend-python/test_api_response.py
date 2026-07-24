import unittest

from api_response import error_payload, success_payload


class ApiResponsePayloadTests(unittest.TestCase):
    def test_object_response_keeps_legacy_fields_and_adds_envelope(self):
        payload = {"token": "abc", "is_new_user": False}

        result = success_payload(payload)

        self.assertEqual(result["code"], 0)
        self.assertEqual(result["token"], "abc")
        self.assertEqual(result["data"], payload)

    def test_list_response_is_wrapped(self):
        payload = [{"Id": 1}]

        result = success_payload(payload)

        self.assertEqual(result, {"code": 0, "msg": "请求成功", "data": payload})

    def test_existing_envelope_is_not_double_wrapped(self):
        payload = {"code": 0, "msg": "支付成功", "data": {"order_id": 1}}

        self.assertIs(success_payload(payload), payload)

    def test_legacy_code_response_gets_data_without_losing_fields(self):
        payload = {"code": 0, "msg": "成功", "order_id": 1}

        result = success_payload(payload)

        self.assertEqual(result["order_id"], 1)
        self.assertEqual(result["data"], payload)

    def test_error_response_has_new_and_legacy_fields(self):
        result = error_payload(400, "已有待审核的修改申请，请等待审核结果")

        self.assertEqual(result["code"], 400)
        self.assertIsNone(result["data"])
        self.assertEqual(result["msg"], result["detail"])


if __name__ == "__main__":
    unittest.main()
