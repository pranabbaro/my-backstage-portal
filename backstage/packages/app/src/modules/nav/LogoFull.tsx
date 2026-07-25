import { makeStyles } from '@material-ui/core';

const useStyles = makeStyles({
  logo: { display: 'flex', alignItems: 'center', height: 40, fontSize: 20, fontWeight: 700, color: '#7df3e1', whiteSpace: 'nowrap' },
});

export const LogoFull = () => {
  const classes = useStyles();
  return <div className={classes.logo}>Developer Portal</div>;
};
