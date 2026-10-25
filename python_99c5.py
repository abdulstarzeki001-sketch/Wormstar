# في السكريبت السابق، بعد استلام النتيجة:
final_result = response['output']

# إضافة طبقة التدقيق (The Check)
review_prompt = f"""
Analyze the following result for errors, security risks, or incomplete tasks.
Result: {final_result}
If there is an error, propose a fix. If it is correct, just say "VALIDATED".
"""
verification = llm.invoke(review_prompt)

if "VALIDATED" not in verification.content:
 print("System: Detected inconsistency. Re-calculating...")
 # إعادة تنفيذ الكود بناءً على التحقق
 agent_executor.invoke({"input": f"Fix the issues mentioned: {final_result}"})