import { getResourceTableName, docClient } from '../db';
import Resource from '../model/Resource';
import { getUserById } from './userRepository';

const getUserResources = userId => new Promise((resolve, reject) => {
  const params = {
    TableName: getResourceTableName(),
    ExpressionAttributeValues: {
      ':uid': userId,
    },
    FilterExpression: 'userId = :uid',
  };

  docClient.scan(params, (err, data) => {
    if (err) {
      // eslint-disable-next-line no-console
      console.error(err);

      return reject(err);
    }

    return resolve(data.Items.map(r => new Resource(r)));
  });
});

const checkQuota = userId => getUserById(userId)
  .then(({ quota }) => {
    if (quota < 0) {
      return true;
    }

    return getUserResources(userId)
      .then(resources => resources.length < quota);
  });

const saveResource = (resource, isNew) => {
  // TODO: Check quota
  const { valid, error } = resource.validate();

  if (!valid) {
    return Promise.resolve({
      success: false,
      result: error,
    });
  }

  const params = {
    TableName: getResourceTableName(),
    Item: resource.save(),
  };

  if (isNew) {
    params.ConditionExpression = 'attribute_not_exists(resourceName)';
  }

  return new Promise((resolve, reject) => {
    docClient.put(params, (err) => {
      if (err) {
        switch (err.name) {
          case 'ConditionalCheckFailedException':
            resolve({
              success: false,
              result: 'Resource already exists',
            });
            break;
          default:
            // eslint-disable-next-line no-console
            console.error(err);

            reject(err);
        }
      } else {
        resolve({ success: true, result: null });
      }
    });
  });
};

const deleteResource = (userId, id) => {
  const resourceName = Resource.getNameFromId(id);

  if (resourceName === null) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const params = {
      TableName: getResourceTableName(),
      Key: { resourceName, userId },
    };

    docClient.delete(params, (err) => {
      if (err) {
        // eslint-disable-next-line no-console
        console.error(err);

        reject(err);
      } else {
        resolve();
      }
    });
  });
};

export {
  checkQuota,
  getUserResources,
  saveResource,
  deleteResource,
};
