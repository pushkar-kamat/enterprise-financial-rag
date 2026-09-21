import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
} from "amazon-cognito-identity-js";

const poolData = {
  UserPoolId: "ap-south-1_uinZg79eV",
  ClientId: "2r78b1esg1tbofu9k0gm42431f",
};

export const userPool = new CognitoUserPool(poolData);

export function signUp({ name, email, password }) {
  const attributes = [
    new CognitoUserAttribute({
      Name: "email",
      Value: email,
    }),
    new CognitoUserAttribute({
      Name: "name",
      Value: name,
    }),
  ];

  return new Promise((resolve, reject) => {
    userPool.signUp(email, password, attributes, null, (error, result) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(result);
    });
  });
}

export function confirmSignUp({ email, code }) {
  const user = new CognitoUser({
    Username: email,
    Pool: userPool,
  });

  return new Promise((resolve, reject) => {
    user.confirmRegistration(code, true, (error, result) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(result);
    });
  });
}

export function signIn({ email, password }) {
  const authenticationDetails = new AuthenticationDetails({
    Username: email,
    Password: password,
  });

  const user = new CognitoUser({
    Username: email,
    Pool: userPool,
  });

  return new Promise((resolve, reject) => {
    user.authenticateUser(authenticationDetails, {
      onSuccess: (session) => {
        localStorage.setItem("northstar_user_email", email);
        resolve(session);
      },
      onFailure: reject,
    });
  });
}

export function getCurrentUser() {
  return userPool.getCurrentUser();
}

export function getCurrentUserAttributes() {
  const user = userPool.getCurrentUser();

  if (!user) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    user.getUserAttributes((error, attributes) => {
      if (error) {
        reject(error);
        return;
      }

      const values = {};

      for (const attribute of attributes || []) {
        values[attribute.getName()] = attribute.getValue();
      }

      resolve(values);
    });
  });
}

export function signOut() {
  const user = userPool.getCurrentUser();

  if (user) {
    user.signOut();
  }

  localStorage.removeItem("northstar_user_email");
}

export function getAccessToken() {
  const user = userPool.getCurrentUser();

  if (!user) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    user.getSession((error, session) => {
      if (error) {
        reject(error);
        return;
      }

      if (!session?.isValid()) {
        resolve(null);
        return;
      }

      resolve(session.getAccessToken().getJwtToken());
    });
  });
}

export async function getCurrentUserEmail() {
  const user = userPool.getCurrentUser();

  if (!user) {
    return null;
  }

  return new Promise((resolve, reject) => {
    user.getSession((error, session) => {
      if (error) {
        reject(error);
        return;
      }

      if (!session?.isValid()) {
        resolve(null);
        return;
      }

      const idToken = session.getIdToken().getJwtToken();

      try {
        const payload = JSON.parse(
          atob(idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
        );

        resolve(payload.email || null);
      } catch (decodeError) {
        reject(decodeError);
      }
    });
  });
}
