import base58
import json

# 替换为你的文件名
with open('/home/chris/.config/solana/id2.json', 'r') as f:
    keypair = json.load(f)

# 将数组转为字节
private_key_bytes = bytes(keypair)

# 转换为 base58 编码
private_key_base58 = base58.b58encode(private_key_bytes).decode('utf-8')

print("Base58 Private Key:", private_key_base58)
