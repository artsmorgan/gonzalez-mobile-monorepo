export const convertDateTimestampToLocalString = (dateUser: string, showTime: boolean = true) => {
  try {
    if (!dateUser) return 'N/A';
    if (typeof dateUser === 'number') {
      dateUser = new Date(dateUser).toISOString();
    }
    if (typeof dateUser === 'string') {
      dateUser = new Date(dateUser).toISOString();
    }
    const dateToUse = dateUser;
    const dateSplit = dateToUse.split('T');
    const dateStringSplit = dateSplit[0].split('-');
    const dateString = `${dateStringSplit[2]}-${dateStringSplit[1]}-${dateStringSplit[0]}`;
    const timeString = dateSplit[1].split('.')[0];
    let dateTimeReturn = `${dateString}`;
    if (showTime) {
      dateTimeReturn += ` ${timeString}`;
    }
    return dateTimeReturn;
  } catch {
    return 'N/A';
  }
  };