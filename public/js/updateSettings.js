/* eslint-disable*/
import axios from 'axios';
import { showAlert } from './alerts';

// type is either 'password', 'data'
export const updateSettings = async (data, type) => {
  try {
    //check if type is password, then first url else second url
    const url =
      type === 'password'
        ? '/api/v1/users/updateMyPassword'
        : '/api/v1/users/updateMe';

    const res = await axios({
      method: 'PATCH',
      url,
      data,
    });

    if (res.data.status === 'success') {
      showAlert(res.data.status, `${type.toUpperCase()} updated successfully`);
    }
  } catch (err) {
    showAlert('error', err.response.data.message);
  }
};
