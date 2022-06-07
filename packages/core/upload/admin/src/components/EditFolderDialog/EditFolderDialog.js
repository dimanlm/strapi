import * as yup from 'yup';
import { Formik } from 'formik';
import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import isEmpty from 'lodash/isEmpty';
import { useIntl } from 'react-intl';
import { Button } from '@strapi/design-system/Button';
import { Grid, GridItem } from '@strapi/design-system/Grid';
import { ModalLayout, ModalBody, ModalFooter } from '@strapi/design-system/ModalLayout';
import { FieldLabel } from '@strapi/design-system/Field';
import { Flex } from '@strapi/design-system/Flex';
import { Loader } from '@strapi/design-system/Loader';
import { Stack } from '@strapi/design-system/Stack';
import { TextInput } from '@strapi/design-system/TextInput';
import { Typography } from '@strapi/design-system/Typography';
import { VisuallyHidden } from '@strapi/design-system/VisuallyHidden';
import { Form, useNotification, getAPIInnerErrors } from '@strapi/helper-plugin';

import { getTrad, findRecursiveFolderByValue } from '../../utils';
import { FolderDefinition } from '../../constants';
import { useEditFolder } from '../../hooks/useEditFolder';
import { useBulkRemove } from '../../hooks/useBulkRemove';
import { useFolderStructure } from '../../hooks/useFolderStructure';
import { useMediaLibraryPermissions } from '../../hooks/useMediaLibraryPermissions';
import { ContextInfo } from '../ContextInfo';
import SelectTree from '../SelectTree';
import { EditFolderModalHeader } from './ModalHeader';
import RemoveFolderDialog from './RemoveFolderDialog';

const folderSchema = yup.object({
  name: yup.string().required(),
  parent: yup
    .object({
      label: yup.string(),
      value: yup.number().nullable(true),
    })
    .nullable(true),
});

export const EditFolderDialog = ({ onClose, folder, parentFolderId }) => {
  const { data: folderStructure, isLoading: folderStructureIsLoading } = useFolderStructure({
    enabled: true,
  });
  const { canCreate, isLoading: isLoadingPermissions, canUpdate } = useMediaLibraryPermissions();
  const submitButtonRef = useRef(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { formatMessage, formatDate } = useIntl();
  const { editFolder, isLoading: isEditFolderLoading } = useEditFolder();
  const { remove } = useBulkRemove();
  const toggleNotification = useNotification();
  const isLoading = isLoadingPermissions || folderStructureIsLoading || isEditFolderLoading;
  const isEditing = !!folder;
  const formDisabled = (folder && !canUpdate) || (!folder && !canCreate);
  const initialFormData = !folderStructureIsLoading && {
    name: folder?.name ?? undefined,
    parent: {
      value: parentFolderId ? parseInt(parentFolderId, 10) : folderStructure[0].value,
      label: parentFolderId
        ? findRecursiveFolderByValue(folderStructure, parseInt(parentFolderId, 10))?.label
        : folderStructure[0].label,
    },
  };

  const handleSubmit = async (values, { setErrors }) => {
    try {
      await editFolder(
        {
          ...values,
          parent: values.parent.value ?? null,
        },
        folder?.id
      );

      toggleNotification({
        type: 'success',
        message: isEditing
          ? formatMessage({
              id: getTrad('modal.folder-notification-edited-success'),
              defaultMessage: 'Folder successfully edited',
            })
          : formatMessage({
              id: getTrad('modal.folder-notification-created-success'),
              defaultMessage: 'Folder successfully created',
            }),
      });

      onClose({ created: true });
    } catch (err) {
      const errors = getAPIInnerErrors(err, { getTrad });
      const formikErrors = Object.entries(errors).reduce((acc, [key, error]) => {
        acc[key] = error.defaultMessage;

        return acc;
      }, {});

      if (!isEmpty(formikErrors)) {
        setErrors(formikErrors);
      }
    }
  };

  const handleDelete = async () => {
    await remove([folder]);

    setShowConfirmDialog(false);
    onClose();
  };

  if (isLoading) {
    return (
      <ModalLayout onClose={() => onClose()} labelledBy="title">
        <EditFolderModalHeader isEditing={isEditing} />

        <ModalBody>
          <Flex justifyContent="center" paddingTop={4} paddingBottom={4}>
            <Loader>
              {formatMessage({
                id: getTrad('list.asset.load'),
                defaultMessage: 'Content is loading.',
              })}
            </Loader>
          </Flex>
        </ModalBody>
      </ModalLayout>
    );
  }

  return (
    <>
      <ModalLayout onClose={() => onClose()} labelledBy="title">
        <EditFolderModalHeader isEditing={isEditing} />

        <ModalBody>
          <Formik
            validationSchema={folderSchema}
            validateOnChange={false}
            onSubmit={handleSubmit}
            initialValues={initialFormData}
          >
            {({ values, errors, handleChange, setFieldValue }) => (
              <Form noValidate>
                <Grid gap={4}>
                  {isEditing && (
                    <GridItem xs={12} col={12}>
                      <ContextInfo
                        blocks={[
                          {
                            label: formatMessage({
                              id: getTrad('modal.folder.create.elements'),
                              defaultMessage: 'Elements',
                            }),
                            value: formatMessage(
                              {
                                id: getTrad('modal.folder.elements.count'),
                                defaultMessage: '{assetCount} assets, {folderCount} folders',
                              },
                              {
                                assetCount: folder?.files?.count ?? 0,
                                folderCount: folder?.children?.length ?? 0,
                              }
                            ),
                          },

                          {
                            label: formatMessage({
                              id: getTrad('modal.folder.create.creation-date'),
                              defaultMessage: 'Creation Date',
                            }),
                            value: formatDate(new Date(folder.createdAt)),
                          },
                        ]}
                      />
                    </GridItem>
                  )}

                  <GridItem xs={12} col={6}>
                    <TextInput
                      label={formatMessage({
                        id: getTrad('form.input.label.folder-name'),
                        defaultMessage: 'Name',
                      })}
                      name="name"
                      value={values.name}
                      error={errors.name}
                      onChange={handleChange}
                      disabled={formDisabled}
                    />
                  </GridItem>

                  <GridItem xs={12} col={6}>
                    <Stack spacing={1}>
                      <FieldLabel htmlFor="folder-parent">
                        {formatMessage({
                          id: getTrad('form.input.label.folder-location'),
                          defaultMessage: 'Location',
                        })}
                      </FieldLabel>

                      <SelectTree
                        options={folderStructure}
                        onChange={value => {
                          setFieldValue('parent', value);
                        }}
                        defaultValue={values.parent}
                        name="parent"
                        menuPortalTarget={document.querySelector('body')}
                        inputId="folder-parent"
                        disabled={formDisabled}
                        {...(errors.parent
                          ? {
                              'aria-errormessage': 'folder-parent-error',
                              'aria-invalid': true,
                            }
                          : {})}
                      />

                      {errors.parent && (
                        <Typography
                          variant="pi"
                          as="p"
                          id="folder-parent-error"
                          textColor="danger600"
                        >
                          {errors.parent}
                        </Typography>
                      )}
                    </Stack>
                  </GridItem>
                </Grid>

                <VisuallyHidden>
                  <button type="submit" tabIndex={-1} ref={submitButtonRef} name="hidden-submit">
                    {formatMessage({ id: 'submit', defaultMessage: 'Submit' })}
                  </button>
                </VisuallyHidden>
              </Form>
            )}
          </Formik>
        </ModalBody>

        <ModalFooter
          startActions={
            <Button onClick={() => onClose()} variant="tertiary" name="cancel">
              {formatMessage({ id: 'cancel', defaultMessage: 'Cancel' })}
            </Button>
          }
          endActions={
            <Stack horizontal spacing={2}>
              {isEditing && canUpdate && (
                <Button
                  type="button"
                  variant="danger-light"
                  onClick={() => setShowConfirmDialog(true)}
                  name="delete"
                >
                  {formatMessage({
                    id: 'modal.folder.create.delete',
                    defaultMessage: 'Delete folder',
                  })}
                </Button>
              )}

              <Button
                onClick={() => submitButtonRef.current.click()}
                name="submit"
                loading={isLoading}
                disabled={formDisabled}
              >
                {formatMessage(
                  isEditing
                    ? { id: 'modal.folder.edit.submit', defaultMessage: 'Save' }
                    : { id: 'modal.folder.create.submit', defaultMessage: 'Create' }
                )}
              </Button>
            </Stack>
          }
        />
      </ModalLayout>
      {showConfirmDialog && (
        <RemoveFolderDialog onClose={() => setShowConfirmDialog(false)} onConfirm={handleDelete} />
      )}
    </>
  );
};

EditFolderDialog.defaultProps = {
  folder: undefined,
  parentFolderId: null,
};

EditFolderDialog.propTypes = {
  folder: FolderDefinition,
  onClose: PropTypes.func.isRequired,
  parentFolderId: PropTypes.number,
};