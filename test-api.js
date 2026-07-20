async function test() {
  const loginRes = await fetch("http://localhost:5000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", password: "password123" })
  });
  const loginData = await loginRes.json();
  console.log("Login:", loginData);

  if (!loginData.data) return;

  const token = loginData.data.token;
  
  const createRes = await fetch("http://localhost:5000/api/members", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      firstName: "Test",
      lastName: "User",
      email: "test_member@example.com",
      password: "password123",
      dob: "",
      gender: "MALE"
    })
  });
  
  const createData = await createRes.json();
  console.log("Create Member Status:", createRes.status);
  console.log("Create Member:", createData);
}
test();
